package com.campus.service.impl;

import cn.hutool.core.util.RandomUtil;
import cn.hutool.core.util.StrUtil;
import cn.hutool.crypto.digest.DigestUtil;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.campus.dto.ActivityCheckInCodeDTO;
import com.campus.dto.ActivityCheckInDTO;
import com.campus.dto.Result;
import com.campus.dto.UserDTO;
import com.campus.entity.Activity;
import com.campus.entity.ActivityRegistration;
import com.campus.entity.User;
import com.campus.mapper.ActivityMapper;
import com.campus.mapper.ActivityRegistrationMapper;
import com.campus.mapper.UserMapper;
import com.campus.service.IActivityService;
import com.campus.utils.CacheClient;
import com.campus.utils.RedisIdWorker;
import com.campus.utils.SystemConstants;
import com.campus.utils.UserHolder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static com.campus.utils.RedisConstants.ACTIVITY_CACHE_VERSION_KEY;
import static com.campus.utils.RedisConstants.ACTIVITY_META_KEY;
import static com.campus.utils.RedisConstants.ACTIVITY_REGISTER_USERS_KEY;
import static com.campus.utils.RedisConstants.ACTIVITY_SLOTS_KEY;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_CATEGORIES_KEY;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_CATEGORIES_TTL;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_DETAIL_KEY;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_DETAIL_TTL;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_LIST_KEY;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_LIST_TTL;

@Slf4j
@Service
public class ActivityServiceImpl extends ServiceImpl<ActivityMapper, Activity> implements IActivityService {

    private static final int STATUS_PUBLISHED = 2;
    private static final int REGISTRATION_ACTIVE = 1;
    private static final int CHECKED_IN = 1;
    private static final int CHECKIN_CODE_TTL_MINUTES = 180;
    private static final long LIST_VERSION_DEFAULT = 1L;
    private static final DefaultRedisScript<Long> ACTIVITY_REGISTER_SCRIPT;

    static {
        ACTIVITY_REGISTER_SCRIPT = new DefaultRedisScript<>();
        ACTIVITY_REGISTER_SCRIPT.setLocation(new ClassPathResource("activity_register.lua"));
        ACTIVITY_REGISTER_SCRIPT.setResultType(Long.class);
    }

    @Resource
    private ActivityRegistrationMapper activityRegistrationMapper;

    @Resource
    private UserMapper userMapper;

    @Resource
    private StringRedisTemplate stringRedisTemplate;

    @Resource
    private CacheClient cacheClient;

    @Resource
    private RedisIdWorker redisIdWorker;

    @Resource
    private TransactionTemplate transactionTemplate;

    @Override
    public Result queryPublicActivities(String keyword, String category, Integer status, Integer current, Integer pageSize) {
        CachedActivityPage cachedPage = queryCachedActivityPage(keyword, category, status, current, pageSize);
        List<Activity> records = cachedPage.getRecords();
        syncRemainingSlots(records);
        enrichActivities(records, UserHolder.getUser());
        return Result.ok(records, cachedPage.getTotal());
    }

    @Override
    public Result queryPublicCategories() {
        String key = CACHE_ACTIVITY_CATEGORIES_KEY + currentActivityCacheVersion();
        String categoriesJson = stringRedisTemplate.opsForValue().get(key);
        if (StrUtil.isNotBlank(categoriesJson)) {
            return Result.ok(JSONUtil.parseArray(categoriesJson).toList(String.class));
        }
        QueryWrapper<Activity> wrapper = new QueryWrapper<>();
        wrapper.select("DISTINCT category")
                .isNotNull("category")
                .ne("category", "")
                .eq("status", STATUS_PUBLISHED)
                .orderByAsc("category");
        List<String> categories = listObjs(wrapper, item -> item == null ? null : item.toString())
                .stream()
                .filter(StrUtil::isNotBlank)
                .collect(Collectors.toList());
        stringRedisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(categories), CACHE_ACTIVITY_CATEGORIES_TTL, TimeUnit.MINUTES);
        return Result.ok(categories);
    }

    @Override
    public Result queryActivityDetail(Long id) {
        Activity activity = cacheClient.queryWithPassThrough(
                CACHE_ACTIVITY_DETAIL_KEY,
                id,
                Activity.class,
                this::getById,
                CACHE_ACTIVITY_DETAIL_TTL,
                TimeUnit.MINUTES
        );
        if (activity == null) {
            return Result.fail("活动不存在");
        }
        syncRemainingSlots(Collections.singletonList(activity));
        enrichActivities(Collections.singletonList(activity), UserHolder.getUser());
        return Result.ok(activity);
    }

    @Override
    @Transactional
    public Result createActivity(Activity activity) {
        UserDTO user = UserHolder.getUser();
        String error = validateActivity(activity);
        if (error != null) {
            return Result.fail(error);
        }
        activity.setId(null);
        activity.setCreatorId(user.getId());
        if (StrUtil.isBlank(activity.getOrganizerName())) {
            activity.setOrganizerName(user.getNickName());
        }
        if (activity.getRegisteredCount() == null) {
            activity.setRegisteredCount(0);
        }
        if (activity.getStatus() == null) {
            activity.setStatus(STATUS_PUBLISHED);
        }
        normalizeActivityImages(activity);
        if (!Boolean.TRUE.equals(activity.getCheckInEnabled())) {
            activity.setCheckInCode(null);
            activity.setCheckInCodeExpireTime(null);
        }
        save(activity);
        refreshActivityCacheState(activity.getId());
        return Result.ok(activity.getId());
    }

    @Override
    @Transactional
    public Result updateActivity(Activity activity) {
        if (activity.getId() == null) {
            return Result.fail("活动ID不能为空");
        }
        Activity existing = getById(activity.getId());
        if (existing == null) {
            return Result.fail("活动不存在");
        }
        if (!Objects.equals(existing.getCreatorId(), UserHolder.getUser().getId())) {
            return Result.fail("无权修改该活动");
        }
        String error = validateActivity(activity);
        if (error != null) {
            return Result.fail(error);
        }
        existing.setTitle(activity.getTitle());
        existing.setCoverImage(activity.getCoverImage());
        existing.setImages(activity.getImages());
        existing.setSummary(activity.getSummary());
        existing.setContent(activity.getContent());
        existing.setCategory(activity.getCategory());
        existing.setLocation(activity.getLocation());
        existing.setOrganizerName(StrUtil.isBlank(activity.getOrganizerName()) ? existing.getOrganizerName() : activity.getOrganizerName());
        existing.setMaxParticipants(activity.getMaxParticipants());
        existing.setRegistrationStartTime(activity.getRegistrationStartTime());
        existing.setRegistrationEndTime(activity.getRegistrationEndTime());
        existing.setEventStartTime(activity.getEventStartTime());
        existing.setEventEndTime(activity.getEventEndTime());
        existing.setStatus(activity.getStatus() == null ? STATUS_PUBLISHED : activity.getStatus());
        existing.setCheckInEnabled(Boolean.TRUE.equals(activity.getCheckInEnabled()));
        normalizeActivityImages(existing);
        if (!Boolean.TRUE.equals(activity.getCheckInEnabled())) {
            existing.setCheckInCode(null);
            existing.setCheckInCodeExpireTime(null);
        }
        updateById(existing);
        refreshActivityCacheState(existing.getId());
        return Result.ok();
    }

    @Override
    public Result queryMyCreatedActivities(Integer current, Integer pageSize) {
        Page<Activity> page = query()
                .eq("creator_id", UserHolder.getUser().getId())
                .orderByDesc("create_time")
                .page(new Page<>(current, normalizePageSize(pageSize)));
        List<Activity> records = page.getRecords();
        syncRemainingSlots(records);
        enrichActivities(records, UserHolder.getUser());
        return Result.ok(records, page.getTotal());
    }

    @Override
    public Result register(Long activityId) {
        Activity activity = getById(activityId);
        if (activity == null) {
            return Result.fail("活动不存在");
        }
        ensureActivityRegistrationCache(activity);
        Long userId = UserHolder.getUser().getId();
        Long result = stringRedisTemplate.execute(
                ACTIVITY_REGISTER_SCRIPT,
                Collections.emptyList(),
                activityId.toString(),
                userId.toString(),
                String.valueOf(LocalDateTime.now().toEpochSecond(ZoneOffset.UTC))
        );
        int code = result == null ? -1 : result.intValue();
        if (code == 0) {
            try {
                Boolean saved = transactionTemplate.execute(status -> saveRegistrationRecord(activityId, userId));
                if (!Boolean.TRUE.equals(saved)) {
                    compensateRegistrationCache(activityId, userId);
                    return Result.fail("活动不存在");
                }
                return Result.ok();
            } catch (Exception e) {
                log.error("活动报名同步落库失败，执行缓存补偿 activityId={}, userId={}", activityId, userId, e);
                compensateRegistrationCache(activityId, userId);
                return Result.fail("报名失败，请稍后重试");
            }
        }
        if (code == 1) {
            return Result.fail("活动名额已满");
        }
        if (code == 2) {
            return Result.fail("你已经报过名了");
        }
        if (code == 3) {
            return Result.fail("活动当前不可报名");
        }
        if (code == 4) {
            return Result.fail("报名尚未开始");
        }
        if (code == 5) {
            return Result.fail("报名已经结束");
        }
        if (code == 6) {
            refreshActivityCacheState(activityId);
            return Result.fail("活动不存在");
        }
        return Result.fail("报名失败，请稍后重试");
    }

    @Override
    public Result queryMyRegistrations(Integer current, Integer pageSize) {
        Page<ActivityRegistration> page = new Page<>(current, normalizePageSize(pageSize));
        QueryWrapper<ActivityRegistration> wrapper = new QueryWrapper<ActivityRegistration>()
                .eq("user_id", UserHolder.getUser().getId())
                .orderByDesc("create_time");
        activityRegistrationMapper.selectPage(page, wrapper);
        List<ActivityRegistration> records = page.getRecords();
        enrichRegistrationActivities(records);
        return Result.ok(records, page.getTotal());
    }

    @Override
    public Result queryActivityRegistrations(Long activityId, Integer current, Integer pageSize) {
        Activity activity = getById(activityId);
        if (activity == null) {
            return Result.fail("活动不存在");
        }
        if (!Objects.equals(activity.getCreatorId(), UserHolder.getUser().getId())) {
            return Result.fail("无权查看该活动报名名单");
        }
        Page<ActivityRegistration> page = new Page<>(current, normalizePageSize(pageSize));
        QueryWrapper<ActivityRegistration> wrapper = new QueryWrapper<ActivityRegistration>()
                .eq("activity_id", activityId)
                .orderByDesc("create_time");
        activityRegistrationMapper.selectPage(page, wrapper);
        List<ActivityRegistration> records = page.getRecords();
        enrichParticipantUsers(records);
        return Result.ok(records, page.getTotal());
    }

    @Override
    @Transactional
    public Result updateCheckInCode(Long activityId, ActivityCheckInCodeDTO dto) {
        Activity activity = getById(activityId);
        if (activity == null) {
            return Result.fail("活动不存在");
        }
        if (!Objects.equals(activity.getCreatorId(), UserHolder.getUser().getId())) {
            return Result.fail("无权配置签到码");
        }
        String code = dto == null ? null : dto.getCheckInCode();
        if (StrUtil.isBlank(code)) {
            code = RandomUtil.randomNumbers(6);
        }
        int validMinutes = dto == null || dto.getValidMinutes() == null || dto.getValidMinutes() < 1
                ? CHECKIN_CODE_TTL_MINUTES : dto.getValidMinutes();
        activity.setCheckInEnabled(true);
        activity.setCheckInCode(code);
        activity.setCheckInCodeExpireTime(LocalDateTime.now().plusMinutes(validMinutes));
        updateById(activity);
        refreshActivityCacheState(activityId);
        return Result.ok(activity);
    }

    @Override
    @Transactional
    public Result checkIn(Long activityId, ActivityCheckInDTO dto) {
        Activity activity = getById(activityId);
        if (activity == null) {
            return Result.fail("活动不存在");
        }
        if (!Boolean.TRUE.equals(activity.getCheckInEnabled()) || StrUtil.isBlank(activity.getCheckInCode())) {
            return Result.fail("当前活动未开启签到");
        }
        if (dto == null || StrUtil.isBlank(dto.getCheckInCode())) {
            return Result.fail("签到码不能为空");
        }
        if (!activity.getCheckInCode().equals(dto.getCheckInCode())) {
            return Result.fail("签到码错误");
        }
        if (activity.getCheckInCodeExpireTime() != null && LocalDateTime.now().isAfter(activity.getCheckInCodeExpireTime())) {
            return Result.fail("签到码已过期");
        }
        LocalDateTime now = LocalDateTime.now();
        if (activity.getEventStartTime() != null && now.isBefore(activity.getEventStartTime())) {
            return Result.fail("活动尚未开始签到");
        }
        if (activity.getEventEndTime() != null && now.isAfter(activity.getEventEndTime())) {
            return Result.fail("活动已结束，无法签到");
        }
        ActivityRegistration registration = activityRegistrationMapper.selectOne(new QueryWrapper<ActivityRegistration>()
                .eq("activity_id", activityId)
                .eq("user_id", UserHolder.getUser().getId()));
        if (registration == null) {
            return Result.fail("请先报名再签到");
        }
        if (Objects.equals(registration.getCheckInStatus(), CHECKED_IN)) {
            return Result.fail("你已经签到过了");
        }
        registration.setCheckInStatus(CHECKED_IN);
        registration.setCheckInTime(now);
        activityRegistrationMapper.updateById(registration);
        return Result.ok();
    }

    private void enrichActivities(List<Activity> activities, UserDTO user) {
        if (activities == null || activities.isEmpty()) {
            return;
        }
        Map<Long, ActivityRegistration> registrationMap = Collections.emptyMap();
        if (user != null) {
            List<Long> activityIds = activities.stream().map(Activity::getId).collect(Collectors.toList());
            List<ActivityRegistration> registrations = activityRegistrationMapper.selectList(new QueryWrapper<ActivityRegistration>()
                    .eq("user_id", user.getId())
                    .in("activity_id", activityIds));
            registrationMap = registrations.stream().collect(Collectors.toMap(ActivityRegistration::getActivityId, r -> r, (a, b) -> a));
        }
        LocalDateTime now = LocalDateTime.now();
        for (Activity activity : activities) {
            ActivityRegistration registration = registrationMap.get(activity.getId());
            boolean registered = registration != null;
            if (!registered && user != null) {
                Boolean member = stringRedisTemplate.opsForSet().isMember(activityRegisterUsersKey(activity.getId()), user.getId().toString());
                registered = Boolean.TRUE.equals(member);
            }
            activity.setRegistered(registered);
            activity.setCheckedIn(registration != null && Objects.equals(registration.getCheckInStatus(), CHECKED_IN));
            boolean canManage = user != null && Objects.equals(activity.getCreatorId(), user.getId());
            activity.setCanManage(canManage);
            activity.setRegistrationOpen(isRegistrationOpen(activity, now));
            if (!canManage) {
                activity.setCheckInCode(null);
                activity.setCheckInCodeExpireTime(null);
            }
        }
    }

    private void enrichRegistrationActivities(List<ActivityRegistration> registrations) {
        if (registrations == null || registrations.isEmpty()) {
            return;
        }
        List<Long> activityIds = registrations.stream().map(ActivityRegistration::getActivityId).distinct().collect(Collectors.toList());
        Map<Long, Activity> activityMap = listByIds(activityIds).stream().collect(Collectors.toMap(Activity::getId, a -> a));
        for (ActivityRegistration registration : registrations) {
            Activity activity = activityMap.get(registration.getActivityId());
            if (activity == null) {
                continue;
            }
            registration.setActivityTitle(activity.getTitle());
            registration.setActivityCoverImage(activity.getCoverImage());
            registration.setCategory(activity.getCategory());
            registration.setLocation(activity.getLocation());
            registration.setOrganizerName(activity.getOrganizerName());
            registration.setEventStartTime(activity.getEventStartTime());
            registration.setEventEndTime(activity.getEventEndTime());
            registration.setCheckInEnabled(activity.getCheckInEnabled());
        }
    }

    private void enrichParticipantUsers(List<ActivityRegistration> registrations) {
        if (registrations == null || registrations.isEmpty()) {
            return;
        }
        List<Long> userIds = registrations.stream().map(ActivityRegistration::getUserId).distinct().collect(Collectors.toList());
        Map<Long, User> userMap = userMapper.selectBatchIds(userIds).stream().collect(Collectors.toMap(User::getId, u -> u));
        for (ActivityRegistration registration : registrations) {
            User user = userMap.get(registration.getUserId());
            if (user == null) {
                continue;
            }
            registration.setUserNickName(user.getNickName());
            registration.setUserPhone(user.getPhone());
            registration.setUserIcon(user.getIcon());
        }
    }

    private void syncRemainingSlots(List<Activity> activities) {
        if (activities == null || activities.isEmpty()) {
            return;
        }
        List<String> slotKeys = activities.stream()
                .map(activity -> activitySlotsKey(activity.getId()))
                .collect(Collectors.toList());
        List<String> remainingList = stringRedisTemplate.opsForValue().multiGet(slotKeys);
        List<Activity> missingActivities = new ArrayList<>();
        for (int i = 0; i < activities.size(); i++) {
            Activity activity = activities.get(i);
            String remainingValue = remainingList == null ? null : remainingList.get(i);
            if (StrUtil.isBlank(remainingValue)) {
                missingActivities.add(activity);
                continue;
            }
            applyRegisteredCount(activity, Integer.parseInt(remainingValue));
        }
        for (Activity activity : missingActivities) {
            ensureActivityRegistrationCache(activity);
            String remainingValue = stringRedisTemplate.opsForValue().get(activitySlotsKey(activity.getId()));
            if (StrUtil.isNotBlank(remainingValue)) {
                applyRegisteredCount(activity, Integer.parseInt(remainingValue));
            }
        }
    }

    private void applyRegisteredCount(Activity activity, int remainingSlots) {
        if (activity.getMaxParticipants() == null) {
            return;
        }
        int registeredCount = activity.getMaxParticipants() - Math.max(remainingSlots, 0);
        activity.setRegisteredCount(Math.max(registeredCount, 0));
    }

    private CachedActivityPage queryCachedActivityPage(String keyword, String category, Integer status, Integer current, Integer pageSize) {
        int normalizedPageSize = normalizePageSize(pageSize);
        int currentPage = current == null || current < 1 ? 1 : current;
        Integer targetStatus = status == null ? STATUS_PUBLISHED : status;
        String params = StrUtil.join("|",
                "status=" + targetStatus,
                "category=" + StrUtil.blankToDefault(category, ""),
                "keyword=" + StrUtil.blankToDefault(keyword, ""),
                "current=" + currentPage,
                "pageSize=" + normalizedPageSize);
        String key = CACHE_ACTIVITY_LIST_KEY + currentActivityCacheVersion() + ":" + DigestUtil.md5Hex(params);
        String cacheJson = stringRedisTemplate.opsForValue().get(key);
        if (StrUtil.isNotBlank(cacheJson)) {
            return parseCachedActivityPage(cacheJson);
        }

        QueryWrapper<Activity> wrapper = new QueryWrapper<>();
        wrapper.eq("status", targetStatus)
                .like(StrUtil.isNotBlank(keyword), "title", keyword)
                .eq(StrUtil.isNotBlank(category), "category", category)
                .orderByAsc("event_start_time")
                .orderByDesc("create_time");
        Page<Activity> page = page(new Page<>(currentPage, normalizedPageSize), wrapper);

        Map<String, Object> cacheValue = new HashMap<>(2);
        cacheValue.put("total", page.getTotal());
        cacheValue.put("records", page.getRecords());
        stringRedisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(cacheValue), CACHE_ACTIVITY_LIST_TTL, TimeUnit.MINUTES);
        return new CachedActivityPage(page.getRecords(), page.getTotal());
    }

    private CachedActivityPage parseCachedActivityPage(String cacheJson) {
        JSONObject jsonObject = JSONUtil.parseObj(cacheJson);
        JSONArray recordsArray = jsonObject.getJSONArray("records");
        List<Activity> records = recordsArray == null ? new ArrayList<>() : recordsArray.toList(Activity.class);
        Long total = jsonObject.getLong("total", 0L);
        return new CachedActivityPage(records, total);
    }

    private void refreshActivityCacheState(Long activityId) {
        Activity latest = getById(activityId);
        if (latest == null) {
            stringRedisTemplate.delete(CACHE_ACTIVITY_DETAIL_KEY + activityId);
            stringRedisTemplate.delete(activityMetaKey(activityId));
            stringRedisTemplate.delete(activitySlotsKey(activityId));
            stringRedisTemplate.delete(activityRegisterUsersKey(activityId));
            bumpActivityCacheVersion();
            return;
        }
        stringRedisTemplate.delete(CACHE_ACTIVITY_DETAIL_KEY + activityId);
        initActivityRegistrationCache(latest);
        bumpActivityCacheVersion();
    }

    private void ensureActivityRegistrationCache(Activity activity) {
        Boolean exists = stringRedisTemplate.hasKey(activityMetaKey(activity.getId()));
        if (Boolean.TRUE.equals(exists)) {
            return;
        }
        initActivityRegistrationCache(activity);
    }

    private void initActivityRegistrationCache(Activity activity) {
        Map<String, String> meta = new LinkedHashMap<>();
        meta.put("status", String.valueOf(activity.getStatus() == null ? 0 : activity.getStatus()));
        meta.put("registrationStartEpoch", String.valueOf(toEpoch(activity.getRegistrationStartTime())));
        meta.put("registrationEndEpoch", String.valueOf(toEpoch(activity.getRegistrationEndTime())));
        meta.put("maxParticipants", String.valueOf(activity.getMaxParticipants() == null ? 0 : activity.getMaxParticipants()));
        meta.put("registeredCountBase", String.valueOf(activity.getRegisteredCount() == null ? 0 : activity.getRegisteredCount()));
        stringRedisTemplate.opsForHash().putAll(activityMetaKey(activity.getId()), meta);

        int maxParticipants = activity.getMaxParticipants() == null ? 0 : activity.getMaxParticipants();
        int registeredCount = activity.getRegisteredCount() == null ? 0 : activity.getRegisteredCount();
        int remainingSlots = Math.max(maxParticipants - registeredCount, 0);
        stringRedisTemplate.opsForValue().set(activitySlotsKey(activity.getId()), String.valueOf(remainingSlots));

        List<ActivityRegistration> registrations = activityRegistrationMapper.selectList(new QueryWrapper<ActivityRegistration>()
                .select("user_id")
                .eq("activity_id", activity.getId()));
        String usersKey = activityRegisterUsersKey(activity.getId());
        stringRedisTemplate.delete(usersKey);
        if (!registrations.isEmpty()) {
            String[] userIds = registrations.stream()
                    .map(ActivityRegistration::getUserId)
                    .filter(Objects::nonNull)
                    .map(String::valueOf)
                    .toArray(String[]::new);
            if (userIds.length > 0) {
                stringRedisTemplate.opsForSet().add(usersKey, userIds);
            }
        }
    }

    private Boolean saveRegistrationRecord(Long activityId, Long userId) {
        Activity activity = getById(activityId);
        if (activity == null) {
            return false;
        }
        ActivityRegistration existing = activityRegistrationMapper.selectOne(new QueryWrapper<ActivityRegistration>()
                .eq("activity_id", activityId)
                .eq("user_id", userId));
        if (existing != null) {
            return true;
        }
        ActivityRegistration registration = new ActivityRegistration();
        registration.setActivityId(activityId);
        registration.setUserId(userId);
        registration.setStatus(REGISTRATION_ACTIVE);
        registration.setCheckInStatus(0);
        try {
            activityRegistrationMapper.insert(registration);
        } catch (DuplicateKeyException e) {
            return true;
        }
        UpdateWrapper<Activity> wrapper = new UpdateWrapper<>();
        wrapper.setSql("registered_count = registered_count + 1")
                .eq("id", activityId)
                .lt("registered_count", activity.getMaxParticipants());
        boolean updated = update(null, wrapper);
        if (!updated) {
            throw new IllegalStateException("活动报名落库时名额不足");
        }
        stringRedisTemplate.delete(CACHE_ACTIVITY_DETAIL_KEY + activityId);
        return true;
    }

    private void compensateRegistrationCache(Long activityId, Long userId) {
        stringRedisTemplate.opsForValue().increment(activitySlotsKey(activityId));
        stringRedisTemplate.opsForSet().remove(activityRegisterUsersKey(activityId), userId.toString());
        stringRedisTemplate.delete(CACHE_ACTIVITY_DETAIL_KEY + activityId);
        bumpActivityCacheVersion();
    }

    private long currentActivityCacheVersion() {
        String version = stringRedisTemplate.opsForValue().get(ACTIVITY_CACHE_VERSION_KEY);
        if (StrUtil.isBlank(version)) {
            stringRedisTemplate.opsForValue().setIfAbsent(ACTIVITY_CACHE_VERSION_KEY, String.valueOf(LIST_VERSION_DEFAULT));
            return LIST_VERSION_DEFAULT;
        }
        return Long.parseLong(version);
    }

    private void bumpActivityCacheVersion() {
        if (!Boolean.TRUE.equals(stringRedisTemplate.hasKey(ACTIVITY_CACHE_VERSION_KEY))) {
            stringRedisTemplate.opsForValue().set(ACTIVITY_CACHE_VERSION_KEY, String.valueOf(LIST_VERSION_DEFAULT));
            return;
        }
        stringRedisTemplate.opsForValue().increment(ACTIVITY_CACHE_VERSION_KEY);
    }

    private String activityMetaKey(Long activityId) {
        return ACTIVITY_META_KEY + activityId;
    }

    private String activitySlotsKey(Long activityId) {
        return ACTIVITY_SLOTS_KEY + activityId;
    }

    private String activityRegisterUsersKey(Long activityId) {
        return ACTIVITY_REGISTER_USERS_KEY + activityId;
    }

    private long toEpoch(LocalDateTime time) {
        return time == null ? 0L : time.toEpochSecond(ZoneOffset.UTC);
    }

    private boolean isRegistrationOpen(Activity activity, LocalDateTime now) {
        if (!Objects.equals(activity.getStatus(), STATUS_PUBLISHED)) {
            return false;
        }
        boolean afterStart = activity.getRegistrationStartTime() == null || !now.isBefore(activity.getRegistrationStartTime());
        boolean beforeEnd = activity.getRegistrationEndTime() == null || !now.isAfter(activity.getRegistrationEndTime());
        boolean hasCapacity = activity.getMaxParticipants() == null
                || activity.getRegisteredCount() == null
                || activity.getRegisteredCount() < activity.getMaxParticipants();
        return afterStart && beforeEnd && hasCapacity;
    }

    private int normalizePageSize(Integer pageSize) {
        if (pageSize == null || pageSize < 1) {
            return SystemConstants.DEFAULT_PAGE_SIZE;
        }
        return Math.min(pageSize, 20);
    }

    private String validateActivity(Activity activity) {
        if (activity == null) {
            return "活动信息不能为空";
        }
        if (StrUtil.isBlank(activity.getTitle())) {
            return "活动标题不能为空";
        }
        if (StrUtil.isBlank(activity.getCategory())) {
            return "活动分类不能为空";
        }
        if (StrUtil.isBlank(activity.getLocation())) {
            return "活动地点不能为空";
        }
        if (StrUtil.isBlank(activity.getImages()) && StrUtil.isBlank(activity.getCoverImage())) {
            return "请至少上传一张活动图片";
        }
        if (activity.getMaxParticipants() == null || activity.getMaxParticipants() < 1) {
            return "报名人数上限必须大于0";
        }
        if (activity.getRegistrationStartTime() == null || activity.getRegistrationEndTime() == null) {
            return "请填写完整的报名时间";
        }
        if (activity.getEventStartTime() == null || activity.getEventEndTime() == null) {
            return "请填写完整的活动时间";
        }
        if (!activity.getRegistrationStartTime().isBefore(activity.getRegistrationEndTime())) {
            return "报名开始时间必须早于报名结束时间";
        }
        if (!activity.getEventStartTime().isBefore(activity.getEventEndTime())) {
            return "活动开始时间必须早于活动结束时间";
        }
        if (activity.getRegistrationEndTime().isAfter(activity.getEventStartTime())) {
            return "报名结束时间不能晚于活动开始时间";
        }
        return null;
    }

    private void normalizeActivityImages(Activity activity) {
        if (activity == null) {
            return;
        }
        List<String> imageList = new ArrayList<>();
        if (StrUtil.isNotBlank(activity.getImages())) {
            for (String item : activity.getImages().split(",")) {
                if (StrUtil.isNotBlank(item)) {
                    imageList.add(item.trim());
                }
            }
        }
        if (imageList.isEmpty() && StrUtil.isNotBlank(activity.getCoverImage())) {
            imageList.add(activity.getCoverImage().trim());
        }
        if (imageList.isEmpty()) {
            activity.setImages(null);
            activity.setCoverImage(null);
            return;
        }
        activity.setImages(String.join(",", imageList));
        activity.setCoverImage(imageList.get(0));
    }

    private static class CachedActivityPage {
        private final List<Activity> records;
        private final Long total;

        private CachedActivityPage(List<Activity> records, Long total) {
            this.records = records;
            this.total = total;
        }

        public List<Activity> getRecords() {
            return records;
        }

        public Long getTotal() {
            return total;
        }
    }
}
