package com.campus.service.impl;

import cn.hutool.core.util.StrUtil;
import cn.hutool.crypto.digest.DigestUtil;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.campus.dto.ActivityCheckInResultDTO;
import com.campus.dto.ActivityCheckInStatsDTO;
import com.campus.dto.ActivityCheckInVerifyDTO;
import com.campus.dto.Result;
import com.campus.dto.UserDTO;
import com.campus.entity.Activity;
import com.campus.entity.ActivityCheckInRecord;
import com.campus.entity.ActivityRegistration;
import com.campus.entity.ActivityVoucher;
import com.campus.entity.User;
import com.campus.mapper.ActivityCheckInRecordMapper;
import com.campus.mapper.ActivityMapper;
import com.campus.mapper.ActivityRegistrationMapper;
import com.campus.mapper.ActivityVoucherMapper;
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

import static com.campus.utils.RedisConstants.ACTIVITY_CHECK_IN_IDEMPOTENCY_KEY;
import static com.campus.utils.RedisConstants.ACTIVITY_CHECK_IN_IDEMPOTENCY_TTL_MINUTES;
import static com.campus.utils.RedisConstants.ACTIVITY_META_KEY;
import static com.campus.utils.RedisConstants.ACTIVITY_REGISTER_USERS_KEY;
import static com.campus.utils.RedisConstants.ACTIVITY_SLOTS_KEY;
import static com.campus.utils.RedisConstants.ACTIVITY_VOUCHER_DISPLAY_KEY;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_CATEGORIES_KEY;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_CATEGORIES_TTL;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_CHECK_IN_RECORDS_KEY;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_CHECK_IN_RECORDS_TTL;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_CHECK_IN_STATS_KEY;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_CHECK_IN_STATS_TTL;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_DETAIL_KEY;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_DETAIL_TTL;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_LIST_KEY;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_LIST_TTL;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_USER_STATE_KEY;
import static com.campus.utils.RedisConstants.CACHE_ACTIVITY_USER_STATE_TTL;

@Slf4j
@Service
public class ActivityServiceImpl extends ServiceImpl<ActivityMapper, Activity> implements IActivityService {

    private static final int STATUS_PUBLISHED = 2;
    private static final int REGISTRATION_ACTIVE = 1;
    private static final int CHECKED_IN = 1;
    private static final int CHECKED_OUT = 0;
    private static final int DISPLAY_CODE_LENGTH = 8;
    private static final String DISPLAY_CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final String VOUCHER_STATUS_UNUSED = "UNUSED";
    private static final String VOUCHER_STATUS_CHECKED_IN = "CHECKED_IN";
    private static final String VOUCHER_STATUS_CANCELED = "CANCELED";
    private static final String VOUCHER_STATUS_EXPIRED = "EXPIRED";
    private static final String CHECK_IN_RESULT_SUCCESS = "SUCCESS";
    private static final String CHECK_IN_RESULT_ALREADY_CHECKED_IN = "ALREADY_CHECKED_IN";
    private static final String CHECK_IN_RESULT_INVALID_VOUCHER = "INVALID_VOUCHER";
    private static final String CHECK_IN_RESULT_ACTIVITY_MISMATCH = "ACTIVITY_MISMATCH";
    private static final String CHECK_IN_RESULT_OUT_OF_WINDOW = "OUT_OF_WINDOW";
    private static final String CHECK_IN_RESULT_NOT_REGISTERED = "NOT_REGISTERED";
    private static final String IDEMPOTENCY_STATUS_PROCESSING = "PROCESSING";
    private static final String IDEMPOTENCY_STATUS_SUCCESS = "SUCCESS";
    private static final String IDEMPOTENCY_STATUS_FAILED = "FAILED";
    private static final int CHECK_IN_OPEN_BEFORE_MINUTES = 30;
    private static final int CHECK_IN_CLOSE_AFTER_MINUTES = 30;
    private static final DefaultRedisScript<Long> ACTIVITY_REGISTER_SCRIPT;

    static {
        ACTIVITY_REGISTER_SCRIPT = new DefaultRedisScript<>();
        ACTIVITY_REGISTER_SCRIPT.setLocation(new ClassPathResource("activity_register.lua"));
        ACTIVITY_REGISTER_SCRIPT.setResultType(Long.class);
    }

    @Resource
    private ActivityRegistrationMapper activityRegistrationMapper;

    @Resource
    private ActivityVoucherMapper activityVoucherMapper;

    @Resource
    private ActivityCheckInRecordMapper activityCheckInRecordMapper;

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
        String key = CACHE_ACTIVITY_CATEGORIES_KEY;
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
        activity.setCheckInEnabled(true);
        activity.setCheckInCode(null);
        activity.setCheckInCodeExpireTime(null);
        normalizeActivityImages(activity);
        save(activity);
        refreshActivityCacheState(activity.getId(), true);
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
        existing.setCheckInEnabled(true);
        existing.setCheckInCode(null);
        existing.setCheckInCodeExpireTime(null);
        normalizeActivityImages(existing);
        updateById(existing);
        refreshActivityCacheState(existing.getId(), true);
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
        UserDTO currentUser = UserHolder.getUser();
        if (currentUser != null && Objects.equals(currentUser.getRoleType(), UserDTO.ROLE_ORGANIZER)) {
            return Result.fail("主办方账号不能报名参加活动");
        }
        ensureActivityRegistrationCache(activity);
        Long userId = currentUser.getId();
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
            refreshActivityCacheState(activityId, false);
            return Result.fail("活动不存在");
        }
        return Result.fail("报名失败，请稍后重试");
    }

    @Override
    @Transactional
    public Result cancelRegistration(Long activityId) {
        Activity activity = getById(activityId);
        if (activity == null) {
            return Result.fail("活动不存在");
        }
        UserDTO currentUser = UserHolder.getUser();
        if (currentUser != null && Objects.equals(currentUser.getRoleType(), UserDTO.ROLE_ORGANIZER)) {
            return Result.fail("主办方账号不能退出报名");
        }
        LocalDateTime now = LocalDateTime.now();
        if (activity.getEventStartTime() != null && !now.isBefore(activity.getEventStartTime())) {
            return Result.fail("活动已开始，无法退出报名");
        }
        ActivityRegistration registration = activityRegistrationMapper.selectOne(new QueryWrapper<ActivityRegistration>()
                .eq("activity_id", activityId)
                .eq("user_id", currentUser.getId())
                .eq("status", REGISTRATION_ACTIVE));
        if (registration == null) {
            return Result.fail("你当前未报名该活动");
        }
        ActivityVoucher voucher = activityVoucherMapper.selectOne(new QueryWrapper<ActivityVoucher>()
                .eq("registration_id", registration.getId()));
        if (voucher != null && VOUCHER_STATUS_CHECKED_IN.equals(voucher.getStatus())) {
            return Result.fail("已签到记录不可退出");
        }

        if (voucher != null) {
            activityVoucherMapper.deleteById(voucher.getId());
            if (StrUtil.isNotBlank(voucher.getDisplayCode())) {
                stringRedisTemplate.delete(ACTIVITY_VOUCHER_DISPLAY_KEY + voucher.getDisplayCode());
            }
        }
        activityRegistrationMapper.deleteById(registration.getId());
        UpdateWrapper<Activity> wrapper = new UpdateWrapper<>();
        wrapper.setSql("registered_count = registered_count - 1")
                .eq("id", activityId)
                .gt("registered_count", 0);
        update(null, wrapper);

        stringRedisTemplate.opsForSet().remove(activityRegisterUsersKey(activityId), currentUser.getId().toString());
        stringRedisTemplate.opsForValue().increment(activitySlotsKey(activityId));
        evictActivityCache(activityId, false);
        return Result.ok();
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
        enrichRegistrationVoucherInfo(records);
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
        enrichRegistrationVoucherInfo(records);
        return Result.ok(records, page.getTotal());
    }

    @Override
    public Result verifyCheckIn(Long activityId, ActivityCheckInVerifyDTO dto, String idempotencyKey) {
        Activity activity = getById(activityId);
        if (activity == null) {
            return Result.fail("活动不存在");
        }
        Long operatorId = UserHolder.getUser().getId();
        if (!Objects.equals(activity.getCreatorId(), operatorId)) {
            return Result.fail("无权执行签到核销");
        }
        if (dto == null || (dto.getVoucherId() == null && StrUtil.isBlank(dto.getDisplayCode()))) {
            return Result.fail("请提供凭证ID或展示码");
        }
        if (StrUtil.isBlank(idempotencyKey)) {
            return Result.fail("Idempotency-Key不能为空");
        }
        String fingerprint = buildCheckInFingerprint(activityId, dto);
        String redisKey = ACTIVITY_CHECK_IN_IDEMPOTENCY_KEY + activityId + ":" + idempotencyKey;
        Result cachedResult = resolveCachedCheckInResult(redisKey, fingerprint);
        if (cachedResult != null) {
            return cachedResult;
        }
        JSONObject processing = new JSONObject();
        processing.set("fingerprint", fingerprint);
        processing.set("status", IDEMPOTENCY_STATUS_PROCESSING);
        Boolean locked = stringRedisTemplate.opsForValue().setIfAbsent(
                redisKey,
                processing.toString(),
                ACTIVITY_CHECK_IN_IDEMPOTENCY_TTL_MINUTES,
                TimeUnit.MINUTES
        );
        if (!Boolean.TRUE.equals(locked)) {
            Result retryResult = resolveCachedCheckInResult(redisKey, fingerprint);
            return retryResult == null ? Result.fail("请求处理中，请稍后重试") : retryResult;
        }
        Result result;
        try {
            result = doVerifyCheckIn(activity, dto, operatorId, idempotencyKey, fingerprint);
        } catch (Exception e) {
            log.error("活动凭证核销异常 activityId={}, operatorId={}", activityId, operatorId, e);
            result = Result.fail("签到核销失败，请稍后重试");
        }
        cacheCheckInResult(redisKey, fingerprint, result);
        return result;
    }

    @Override
    public Result queryCheckInStats(Long activityId) {
        Activity activity = getById(activityId);
        if (activity == null) {
            return Result.fail("活动不存在");
        }
        if (!Objects.equals(activity.getCreatorId(), UserHolder.getUser().getId())) {
            return Result.fail("无权查看签到统计");
        }
        ActivityCheckInStatsDTO stats = cacheClient.queryWithPassThrough(
                CACHE_ACTIVITY_CHECK_IN_STATS_KEY,
                activityId,
                ActivityCheckInStatsDTO.class,
                this::loadCheckInStats,
                CACHE_ACTIVITY_CHECK_IN_STATS_TTL,
                TimeUnit.MINUTES
        );
        return Result.ok(stats);
    }

    @Override
    public Result queryCheckInRecords(Long activityId, Integer current, Integer pageSize) {
        Activity activity = getById(activityId);
        if (activity == null) {
            return Result.fail("活动不存在");
        }
        if (!Objects.equals(activity.getCreatorId(), UserHolder.getUser().getId())) {
            return Result.fail("无权查看签到记录");
        }
        CachedCheckInRecordPage cachedPage = queryCachedCheckInRecordPage(activityId, current, pageSize);
        return Result.ok(cachedPage.getRecords(), cachedPage.getTotal());
    }

    private Result doVerifyCheckIn(Activity activity, ActivityCheckInVerifyDTO dto, Long operatorId,
                                   String idempotencyKey, String fingerprint) {
        ActivityVoucher voucher = findVoucher(dto);
        if (voucher == null) {
            Result result = Result.fail("凭证不存在或无效");
            recordCheckInAttempt(activity.getId(), null, null, operatorId, idempotencyKey, fingerprint,
                    CHECK_IN_RESULT_INVALID_VOUCHER, result);
            return result;
        }
        if (!Objects.equals(voucher.getActivityId(), activity.getId())) {
            Result result = Result.fail("凭证与当前活动不匹配");
            recordCheckInAttempt(activity.getId(), voucher.getId(), voucher.getUserId(), operatorId, idempotencyKey,
                    fingerprint, CHECK_IN_RESULT_ACTIVITY_MISMATCH, result);
            return result;
        }
        ActivityRegistration registration = activityRegistrationMapper.selectById(voucher.getRegistrationId());
        if (registration == null || !Objects.equals(registration.getStatus(), REGISTRATION_ACTIVE)) {
            Result result = Result.fail("报名记录不存在或已失效");
            recordCheckInAttempt(activity.getId(), voucher.getId(), voucher.getUserId(), operatorId, idempotencyKey,
                    fingerprint, CHECK_IN_RESULT_NOT_REGISTERED, result);
            return result;
        }
        LocalDateTime now = LocalDateTime.now();
        if (isBeforeCheckInWindow(activity, now)) {
            Result result = Result.fail("未到签到时间窗口");
            recordCheckInAttempt(activity.getId(), voucher.getId(), voucher.getUserId(), operatorId, idempotencyKey,
                    fingerprint, CHECK_IN_RESULT_OUT_OF_WINDOW, result);
            return result;
        }
        if (isAfterCheckInWindow(activity, now)) {
            expireVoucherIfNeeded(voucher);
            Result result = Result.fail("已超过签到时间窗口");
            recordCheckInAttempt(activity.getId(), voucher.getId(), voucher.getUserId(), operatorId, idempotencyKey,
                    fingerprint, CHECK_IN_RESULT_OUT_OF_WINDOW, result);
            return result;
        }
        if (!VOUCHER_STATUS_UNUSED.equals(voucher.getStatus())) {
            return handleUnavailableVoucher(activity.getId(), voucher, operatorId, idempotencyKey, fingerprint);
        }
        return completeCheckIn(activity.getId(), registration, voucher, operatorId, idempotencyKey, fingerprint, now);
    }

    @Transactional
    protected Result completeCheckIn(Long activityId, ActivityRegistration registration, ActivityVoucher voucher,
                                     Long operatorId, String idempotencyKey, String fingerprint, LocalDateTime now) {
        UpdateWrapper<ActivityVoucher> voucherUpdate = new UpdateWrapper<>();
        voucherUpdate.eq("id", voucher.getId())
                .eq("status", VOUCHER_STATUS_UNUSED)
                .set("status", VOUCHER_STATUS_CHECKED_IN)
                .set("checked_in_time", now)
                .set("checked_in_by", operatorId);
        int updated = activityVoucherMapper.update(null, voucherUpdate);
        if (updated == 0) {
            ActivityVoucher latest = activityVoucherMapper.selectById(voucher.getId());
            if (latest == null) {
                Result result = Result.fail("凭证不存在或无效");
                recordCheckInAttempt(activityId, voucher.getId(), voucher.getUserId(), operatorId, idempotencyKey,
                        fingerprint, CHECK_IN_RESULT_INVALID_VOUCHER, result);
                return result;
            }
            return handleUnavailableVoucher(activityId, latest, operatorId, idempotencyKey, fingerprint);
        }

        UpdateWrapper<ActivityRegistration> registrationUpdate = new UpdateWrapper<>();
        registrationUpdate.eq("id", registration.getId())
                .set("check_in_status", CHECKED_IN)
                .set("check_in_time", now)
                .set("voucher_id", voucher.getId());
        activityRegistrationMapper.update(null, registrationUpdate);

        ActivityVoucher latest = activityVoucherMapper.selectById(voucher.getId());
        ActivityCheckInResultDTO payload = buildCheckInResult(activityId, latest, CHECK_IN_RESULT_SUCCESS, "签到成功");
        Result result = Result.ok(payload);
        evictActivityCache(activityId, false);
        recordCheckInAttempt(activityId, voucher.getId(), voucher.getUserId(), operatorId, idempotencyKey, fingerprint,
                CHECK_IN_RESULT_SUCCESS, result);
        return result;
    }

    private Result handleUnavailableVoucher(Long activityId, ActivityVoucher voucher, Long operatorId,
                                            String idempotencyKey, String fingerprint) {
        if (VOUCHER_STATUS_CHECKED_IN.equals(voucher.getStatus())) {
            ActivityCheckInResultDTO payload = buildCheckInResult(activityId, voucher,
                    CHECK_IN_RESULT_ALREADY_CHECKED_IN, "该凭证已签到");
            Result result = Result.ok(payload);
            recordCheckInAttempt(activityId, voucher.getId(), voucher.getUserId(), operatorId, idempotencyKey, fingerprint,
                    CHECK_IN_RESULT_ALREADY_CHECKED_IN, result);
            return result;
        }
        String message = VOUCHER_STATUS_CANCELED.equals(voucher.getStatus()) ? "凭证已取消" :
                (VOUCHER_STATUS_EXPIRED.equals(voucher.getStatus()) ? "凭证已失效" : "凭证当前不可签到");
        Result result = Result.fail(message);
        recordCheckInAttempt(activityId, voucher.getId(), voucher.getUserId(), operatorId, idempotencyKey, fingerprint,
                CHECK_IN_RESULT_INVALID_VOUCHER, result);
        return result;
    }

    private Result resolveCachedCheckInResult(String redisKey, String fingerprint) {
        String cachedJson = stringRedisTemplate.opsForValue().get(redisKey);
        if (StrUtil.isBlank(cachedJson)) {
            return null;
        }
        JSONObject jsonObject = JSONUtil.parseObj(cachedJson);
        String cachedFingerprint = jsonObject.getStr("fingerprint");
        if (StrUtil.isNotBlank(cachedFingerprint) && !Objects.equals(cachedFingerprint, fingerprint)) {
            return Result.fail("Idempotency-Key与请求参数冲突");
        }
        String status = jsonObject.getStr("status");
        if (IDEMPOTENCY_STATUS_PROCESSING.equals(status)) {
            return Result.fail("请求处理中，请稍后重试");
        }
        Boolean success = jsonObject.getBool("success");
        if (Boolean.TRUE.equals(success)) {
            Object response = jsonObject.get("data");
            ActivityCheckInResultDTO payload = response == null ? null :
                    JSONUtil.toBean(JSONUtil.parseObj(response), ActivityCheckInResultDTO.class);
            return Result.ok(payload);
        }
        return Result.fail(jsonObject.getStr("errorMsg", "签到核销失败，请稍后重试"));
    }

    private void cacheCheckInResult(String redisKey, String fingerprint, Result result) {
        JSONObject jsonObject = new JSONObject();
        jsonObject.set("fingerprint", fingerprint);
        jsonObject.set("status", Boolean.TRUE.equals(result.getSuccess()) ? IDEMPOTENCY_STATUS_SUCCESS : IDEMPOTENCY_STATUS_FAILED);
        jsonObject.set("success", result.getSuccess());
        jsonObject.set("errorMsg", result.getErrorMsg());
        jsonObject.set("data", result.getData());
        stringRedisTemplate.opsForValue().set(redisKey, jsonObject.toString(),
                ACTIVITY_CHECK_IN_IDEMPOTENCY_TTL_MINUTES, TimeUnit.MINUTES);
    }

    private ActivityCheckInResultDTO buildCheckInResult(Long activityId, ActivityVoucher voucher,
                                                        String resultStatus, String message) {
        ActivityCheckInResultDTO payload = new ActivityCheckInResultDTO();
        payload.setActivityId(activityId);
        payload.setVoucherId(voucher.getId());
        payload.setDisplayCode(voucher.getDisplayCode());
        payload.setUserId(voucher.getUserId());
        payload.setUserNickName(voucher.getUserNickName());
        payload.setVoucherStatus(voucher.getStatus());
        payload.setResultStatus(resultStatus);
        payload.setMessage(message);
        payload.setCheckedInTime(voucher.getCheckedInTime());
        payload.setCheckedInBy(voucher.getCheckedInBy());
        return payload;
    }

    private void recordCheckInAttempt(Long activityId, Long voucherId, Long userId, Long operatorId, String requestKey,
                                      String requestFingerprint, String resultStatus, Result result) {
        ActivityCheckInRecord record = new ActivityCheckInRecord();
        record.setId(redisIdWorker.nextId("activity-checkin-record"));
        record.setActivityId(activityId);
        record.setVoucherId(voucherId);
        record.setUserId(userId);
        record.setOperatorId(operatorId);
        record.setResultStatus(resultStatus);
        record.setRequestKey(requestKey);
        record.setRequestFingerprint(requestFingerprint);
        record.setResponseBody(JSONUtil.toJsonStr(result));
        activityCheckInRecordMapper.insert(record);
    }

    private ActivityVoucher findVoucher(ActivityCheckInVerifyDTO dto) {
        if (dto.getVoucherId() != null) {
            ActivityVoucher voucher = activityVoucherMapper.selectById(dto.getVoucherId());
            if (voucher != null && StrUtil.isNotBlank(voucher.getDisplayCode())) {
                cacheVoucherDisplayCode(voucher);
            }
            return voucher;
        }
        String displayCode = dto.getDisplayCode().trim().toUpperCase();
        String cachedVoucherId = stringRedisTemplate.opsForValue().get(ACTIVITY_VOUCHER_DISPLAY_KEY + displayCode);
        ActivityVoucher voucher = null;
        if (StrUtil.isNotBlank(cachedVoucherId)) {
            voucher = activityVoucherMapper.selectById(Long.valueOf(cachedVoucherId));
        }
        if (voucher == null) {
            voucher = activityVoucherMapper.selectOne(new QueryWrapper<ActivityVoucher>().eq("display_code", displayCode));
            if (voucher != null) {
                cacheVoucherDisplayCode(voucher);
            }
        }
        if (voucher != null) {
            attachVoucherUserInfo(Collections.singletonList(voucher));
        }
        return voucher;
    }

    private void cacheVoucherDisplayCode(ActivityVoucher voucher) {
        if (voucher == null || StrUtil.isBlank(voucher.getDisplayCode())) {
            return;
        }
        stringRedisTemplate.opsForValue().set(
                ACTIVITY_VOUCHER_DISPLAY_KEY + voucher.getDisplayCode(),
                voucher.getId().toString(),
                1,
                TimeUnit.DAYS
        );
    }

    private String buildCheckInFingerprint(Long activityId, ActivityCheckInVerifyDTO dto) {
        String payload = "activityId=" + activityId
                + "|voucherId=" + String.valueOf(dto.getVoucherId())
                + "|displayCode=" + StrUtil.blankToDefault(dto.getDisplayCode(), "").trim().toUpperCase();
        return DigestUtil.md5Hex(payload);
    }

    private boolean isBeforeCheckInWindow(Activity activity, LocalDateTime now) {
        return activity.getEventStartTime() != null
                && now.isBefore(activity.getEventStartTime().minusMinutes(CHECK_IN_OPEN_BEFORE_MINUTES));
    }

    private boolean isAfterCheckInWindow(Activity activity, LocalDateTime now) {
        return activity.getEventEndTime() != null
                && now.isAfter(activity.getEventEndTime().plusMinutes(CHECK_IN_CLOSE_AFTER_MINUTES));
    }

    private void expireVoucherIfNeeded(ActivityVoucher voucher) {
        if (voucher == null || !VOUCHER_STATUS_UNUSED.equals(voucher.getStatus())) {
            return;
        }
        UpdateWrapper<ActivityVoucher> wrapper = new UpdateWrapper<>();
        wrapper.eq("id", voucher.getId())
                .eq("status", VOUCHER_STATUS_UNUSED)
                .set("status", VOUCHER_STATUS_EXPIRED);
        activityVoucherMapper.update(null, wrapper);
        voucher.setStatus(VOUCHER_STATUS_EXPIRED);
    }

    private void enrichActivities(List<Activity> activities, UserDTO user) {
        if (activities == null || activities.isEmpty()) {
            return;
        }
        Map<Long, ActivityUserStateCache> userStateMap = Collections.emptyMap();
        if (user != null) {
            List<Long> activityIds = activities.stream().map(Activity::getId).collect(Collectors.toList());
            userStateMap = queryActivityUserStateCache(activityIds, user.getId());
        }
        LocalDateTime now = LocalDateTime.now();
        for (Activity activity : activities) {
            ActivityUserStateCache userState = userStateMap.get(activity.getId());
            boolean registered = userState != null && Boolean.TRUE.equals(userState.getRegistered());
            if (!registered && user != null) {
                Boolean member = stringRedisTemplate.opsForSet().isMember(activityRegisterUsersKey(activity.getId()), user.getId().toString());
                registered = Boolean.TRUE.equals(member);
            }
            activity.setRegistered(registered);
            activity.setCheckedIn(userState != null && Boolean.TRUE.equals(userState.getCheckedIn()));
            boolean canManage = user != null && Objects.equals(activity.getCreatorId(), user.getId());
            activity.setCanManage(canManage);
            activity.setRegistrationOpen(isRegistrationOpen(activity, now));
            activity.setVoucherId(userState == null ? null : userState.getVoucherId());
            activity.setVoucherDisplayCode(userState == null ? null : userState.getVoucherDisplayCode());
            activity.setVoucherStatus(userState == null ? null : userState.getVoucherStatus());
            activity.setVoucherIssuedTime(userState == null ? null : userState.getVoucherIssuedTime());
            activity.setVoucherCheckedInTime(userState == null ? null : userState.getVoucherCheckedInTime());
            activity.setCheckInCode(null);
            activity.setCheckInCodeExpireTime(null);
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
            registration.setCheckInEnabled(Boolean.TRUE);
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

    private void enrichRegistrationVoucherInfo(List<ActivityRegistration> registrations) {
        if (registrations == null || registrations.isEmpty()) {
            return;
        }
        List<Long> registrationIds = registrations.stream().map(ActivityRegistration::getId).collect(Collectors.toList());
        List<ActivityVoucher> vouchers = activityVoucherMapper.selectList(new QueryWrapper<ActivityVoucher>()
                .in("registration_id", registrationIds));
        Map<Long, ActivityVoucher> voucherMap = vouchers.stream()
                .collect(Collectors.toMap(ActivityVoucher::getRegistrationId, v -> v, (a, b) -> a));
        Map<Long, String> operatorNameMap = queryUserNameMap(vouchers.stream()
                .map(ActivityVoucher::getCheckedInBy)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList()));
        for (ActivityRegistration registration : registrations) {
            ActivityVoucher voucher = voucherMap.get(registration.getId());
            if (voucher == null) {
                continue;
            }
            registration.setVoucherId(voucher.getId());
            registration.setVoucherDisplayCode(voucher.getDisplayCode());
            registration.setVoucherStatus(voucher.getStatus());
            registration.setVoucherIssuedTime(voucher.getIssuedTime());
            registration.setCheckedInBy(voucher.getCheckedInBy());
            registration.setCheckedInByName(operatorNameMap.get(voucher.getCheckedInBy()));
            registration.setCheckInStatus(VOUCHER_STATUS_CHECKED_IN.equals(voucher.getStatus()) ? CHECKED_IN : CHECKED_OUT);
            registration.setCheckInTime(voucher.getCheckedInTime());
        }
    }

    private void enrichCheckInRecords(List<ActivityCheckInRecord> records) {
        if (records == null || records.isEmpty()) {
            return;
        }
        List<Long> userIds = new ArrayList<>();
        for (ActivityCheckInRecord record : records) {
            if (record.getUserId() != null) {
                userIds.add(record.getUserId());
            }
            if (record.getOperatorId() != null) {
                userIds.add(record.getOperatorId());
            }
        }
        Map<Long, String> userNameMap = queryUserNameMap(userIds.stream().distinct().collect(Collectors.toList()));
        for (ActivityCheckInRecord record : records) {
            if (record.getResponseBody() == null) {
                continue;
            }
            JSONObject response = JSONUtil.parseObj(record.getResponseBody());
            JSONObject data = response.getJSONObject("data");
            if (data != null) {
                data.set("userNickName", userNameMap.get(record.getUserId()));
                data.set("operatorName", userNameMap.get(record.getOperatorId()));
                record.setResponseBody(data.toString());
            }
        }
    }

    private Map<Long, ActivityVoucher> queryVoucherMapByActivityIdsAndUserId(List<Long> activityIds, Long userId) {
        if (activityIds == null || activityIds.isEmpty() || userId == null) {
            return Collections.emptyMap();
        }
        List<ActivityVoucher> vouchers = activityVoucherMapper.selectList(new QueryWrapper<ActivityVoucher>()
                .eq("user_id", userId)
                .in("activity_id", activityIds));
        return vouchers.stream().collect(Collectors.toMap(ActivityVoucher::getActivityId, v -> v, (a, b) -> a));
    }

    private Map<Long, ActivityUserStateCache> queryActivityUserStateCache(List<Long> activityIds, Long userId) {
        if (activityIds == null || activityIds.isEmpty() || userId == null) {
            return Collections.emptyMap();
        }
        List<String> keys = activityIds.stream()
                .map(activityId -> activityUserStateKey(activityId, userId))
                .collect(Collectors.toList());
        List<String> cacheValues = stringRedisTemplate.opsForValue().multiGet(keys);
        Map<Long, ActivityUserStateCache> stateMap = new HashMap<>(activityIds.size());
        List<Long> missedActivityIds = new ArrayList<>();
        for (int i = 0; i < activityIds.size(); i++) {
            Long activityId = activityIds.get(i);
            String cacheJson = cacheValues == null ? null : cacheValues.get(i);
            if (StrUtil.isBlank(cacheJson)) {
                missedActivityIds.add(activityId);
                continue;
            }
            stateMap.put(activityId, JSONUtil.toBean(cacheJson, ActivityUserStateCache.class));
        }
        if (missedActivityIds.isEmpty()) {
            return stateMap;
        }

        List<ActivityRegistration> registrations = activityRegistrationMapper.selectList(new QueryWrapper<ActivityRegistration>()
                .eq("user_id", userId)
                .in("activity_id", missedActivityIds));
        Map<Long, ActivityRegistration> registrationMap = registrations.stream()
                .collect(Collectors.toMap(ActivityRegistration::getActivityId, r -> r, (a, b) -> a));
        Map<Long, ActivityVoucher> voucherMap = queryVoucherMapByActivityIdsAndUserId(missedActivityIds, userId);

        for (Long activityId : missedActivityIds) {
            ActivityRegistration registration = registrationMap.get(activityId);
            ActivityVoucher voucher = voucherMap.get(activityId);
            ActivityUserStateCache state = new ActivityUserStateCache();
            state.setRegistered(registration != null);
            state.setCheckedIn(voucher != null && VOUCHER_STATUS_CHECKED_IN.equals(voucher.getStatus()));
            state.setVoucherId(voucher == null ? null : voucher.getId());
            state.setVoucherDisplayCode(voucher == null ? null : voucher.getDisplayCode());
            state.setVoucherStatus(voucher == null ? null : voucher.getStatus());
            state.setVoucherIssuedTime(voucher == null ? null : voucher.getIssuedTime());
            state.setVoucherCheckedInTime(voucher == null ? null : voucher.getCheckedInTime());
            stateMap.put(activityId, state);
            stringRedisTemplate.opsForValue().set(
                    activityUserStateKey(activityId, userId),
                    JSONUtil.toJsonStr(state),
                    CACHE_ACTIVITY_USER_STATE_TTL,
                    TimeUnit.MINUTES
            );
        }
        return stateMap;
    }

    private ActivityCheckInStatsDTO loadCheckInStats(Long activityId) {
        long registeredCount = activityRegistrationMapper.selectCount(new QueryWrapper<ActivityRegistration>()
                .eq("activity_id", activityId)
                .eq("status", REGISTRATION_ACTIVE));
        long checkedInCount = activityVoucherMapper.selectCount(new QueryWrapper<ActivityVoucher>()
                .eq("activity_id", activityId)
                .eq("status", VOUCHER_STATUS_CHECKED_IN));
        long uncheckedCount = Math.max(registeredCount - checkedInCount, 0);
        double checkInRate = registeredCount == 0 ? 0D : (checkedInCount * 100D / registeredCount);
        return new ActivityCheckInStatsDTO(registeredCount, checkedInCount, uncheckedCount, checkInRate);
    }

    private CachedCheckInRecordPage queryCachedCheckInRecordPage(Long activityId, Integer current, Integer pageSize) {
        int normalizedPageSize = normalizePageSize(pageSize);
        int currentPage = current == null || current < 1 ? 1 : current;
        String key = activityCheckInRecordsKey(activityId, currentPage, normalizedPageSize);
        String cacheJson = stringRedisTemplate.opsForValue().get(key);
        if (StrUtil.isNotBlank(cacheJson)) {
            JSONObject jsonObject = JSONUtil.parseObj(cacheJson);
            JSONArray recordsArray = jsonObject.getJSONArray("records");
            List<ActivityCheckInRecord> records = recordsArray == null ? new ArrayList<>() : recordsArray.toList(ActivityCheckInRecord.class);
            Long total = jsonObject.getLong("total", 0L);
            return new CachedCheckInRecordPage(records, total);
        }
        Page<ActivityCheckInRecord> page = new Page<>(currentPage, normalizedPageSize);
        QueryWrapper<ActivityCheckInRecord> wrapper = new QueryWrapper<ActivityCheckInRecord>()
                .eq("activity_id", activityId)
                .eq("result_status", CHECK_IN_RESULT_SUCCESS)
                .orderByDesc("create_time");
        activityCheckInRecordMapper.selectPage(page, wrapper);
        List<ActivityCheckInRecord> records = page.getRecords();
        enrichCheckInRecords(records);
        Map<String, Object> cacheValue = new HashMap<>(2);
        cacheValue.put("total", page.getTotal());
        cacheValue.put("records", records);
        stringRedisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(cacheValue), CACHE_ACTIVITY_CHECK_IN_RECORDS_TTL, TimeUnit.MINUTES);
        return new CachedCheckInRecordPage(records, page.getTotal());
    }

    private Map<Long, String> queryUserNameMap(List<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Collections.emptyMap();
        }
        return userMapper.selectBatchIds(userIds).stream()
                .collect(Collectors.toMap(User::getId, User::getNickName, (a, b) -> a));
    }

    private void attachVoucherUserInfo(List<ActivityVoucher> vouchers) {
        if (vouchers == null || vouchers.isEmpty()) {
            return;
        }
        Map<Long, String> userNameMap = queryUserNameMap(vouchers.stream()
                .map(ActivityVoucher::getUserId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList()));
        for (ActivityVoucher voucher : vouchers) {
            voucher.setUserNickName(userNameMap.get(voucher.getUserId()));
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
        String key = CACHE_ACTIVITY_LIST_KEY + DigestUtil.md5Hex(params);
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

    private void refreshActivityCacheState(Long activityId, boolean evictCategoryCache) {
        Activity latest = getById(activityId);
        if (latest == null) {
            evictActivityCache(activityId, evictCategoryCache);
            return;
        }
        evictActivityCache(activityId, evictCategoryCache);
        initActivityRegistrationCache(latest);
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
            ensureVoucherForRegistration(existing);
            return true;
        }
        ActivityRegistration registration = new ActivityRegistration();
        registration.setActivityId(activityId);
        registration.setUserId(userId);
        registration.setStatus(REGISTRATION_ACTIVE);
        registration.setCheckInStatus(CHECKED_OUT);
        try {
            activityRegistrationMapper.insert(registration);
        } catch (DuplicateKeyException e) {
            ActivityRegistration duplicated = activityRegistrationMapper.selectOne(new QueryWrapper<ActivityRegistration>()
                    .eq("activity_id", activityId)
                    .eq("user_id", userId));
            if (duplicated != null) {
                ensureVoucherForRegistration(duplicated);
                return true;
            }
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
        ActivityVoucher voucher = createVoucherForRegistration(registration);
        registration.setVoucherId(voucher.getId());
        activityRegistrationMapper.updateById(registration);
        evictActivityCache(activityId, false);
        return true;
    }

    private ActivityVoucher ensureVoucherForRegistration(ActivityRegistration registration) {
        ActivityVoucher existingVoucher = activityVoucherMapper.selectOne(new QueryWrapper<ActivityVoucher>()
                .eq("registration_id", registration.getId()));
        if (existingVoucher != null) {
            if (registration.getVoucherId() == null || !Objects.equals(registration.getVoucherId(), existingVoucher.getId())) {
                registration.setVoucherId(existingVoucher.getId());
                activityRegistrationMapper.updateById(registration);
            }
            cacheVoucherDisplayCode(existingVoucher);
            return existingVoucher;
        }
        ActivityVoucher voucher = createVoucherForRegistration(registration);
        registration.setVoucherId(voucher.getId());
        activityRegistrationMapper.updateById(registration);
        return voucher;
    }

    private ActivityVoucher createVoucherForRegistration(ActivityRegistration registration) {
        ActivityVoucher voucher = new ActivityVoucher();
        voucher.setId(redisIdWorker.nextId("activity-voucher"));
        voucher.setActivityId(registration.getActivityId());
        voucher.setRegistrationId(registration.getId());
        voucher.setUserId(registration.getUserId());
        voucher.setStatus(VOUCHER_STATUS_UNUSED);
        voucher.setIssuedTime(LocalDateTime.now());
        for (int i = 0; i < 10; i++) {
            voucher.setDisplayCode(generateDisplayCode());
            try {
                activityVoucherMapper.insert(voucher);
                cacheVoucherDisplayCode(voucher);
                return voucher;
            } catch (DuplicateKeyException e) {
                log.warn("签到凭证展示码冲突，重试生成 activityId={}, registrationId={}",
                        registration.getActivityId(), registration.getId());
            }
        }
        throw new IllegalStateException("签到凭证生成失败，请稍后重试");
    }

    private String generateDisplayCode() {
        StringBuilder builder = new StringBuilder(DISPLAY_CODE_LENGTH);
        for (int i = 0; i < DISPLAY_CODE_LENGTH; i++) {
            int index = (int) (Math.random() * DISPLAY_CODE_CHARS.length());
            builder.append(DISPLAY_CODE_CHARS.charAt(index));
        }
        return builder.toString();
    }

    private void compensateRegistrationCache(Long activityId, Long userId) {
        stringRedisTemplate.opsForValue().increment(activitySlotsKey(activityId));
        stringRedisTemplate.opsForSet().remove(activityRegisterUsersKey(activityId), userId.toString());
        evictActivityCache(activityId, false);
    }

    private void evictActivityCache(Long activityId, boolean evictCategoryCache) {
        stringRedisTemplate.delete(CACHE_ACTIVITY_DETAIL_KEY + activityId);
        String listPattern = CACHE_ACTIVITY_LIST_KEY + "*";
        java.util.Set<String> listKeys = stringRedisTemplate.keys(listPattern);
        if (listKeys != null && !listKeys.isEmpty()) {
            stringRedisTemplate.delete(listKeys);
        }
        if (evictCategoryCache) {
            stringRedisTemplate.delete(CACHE_ACTIVITY_CATEGORIES_KEY);
        }
        if (activityId == null) {
            return;
        }
        java.util.Set<String> userStateKeys = stringRedisTemplate.keys(CACHE_ACTIVITY_USER_STATE_KEY + activityId + ":*");
        if (userStateKeys != null && !userStateKeys.isEmpty()) {
            stringRedisTemplate.delete(userStateKeys);
        }
        java.util.Set<String> recordKeys = stringRedisTemplate.keys(CACHE_ACTIVITY_CHECK_IN_RECORDS_KEY + activityId + ":*");
        if (recordKeys != null && !recordKeys.isEmpty()) {
            stringRedisTemplate.delete(recordKeys);
        }
        stringRedisTemplate.delete(CACHE_ACTIVITY_CHECK_IN_STATS_KEY + activityId);
        stringRedisTemplate.delete(activityMetaKey(activityId));
        stringRedisTemplate.delete(activitySlotsKey(activityId));
        stringRedisTemplate.delete(activityRegisterUsersKey(activityId));
    }

    private String activityUserStateKey(Long activityId, Long userId) {
        return CACHE_ACTIVITY_USER_STATE_KEY + activityId + ":" + userId;
    }

    private String activityCheckInRecordsKey(Long activityId, Integer current, Integer pageSize) {
        return CACHE_ACTIVITY_CHECK_IN_RECORDS_KEY + activityId + ":" + current + ":" + pageSize;
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

    private static class CachedCheckInRecordPage {
        private final List<ActivityCheckInRecord> records;
        private final Long total;

        private CachedCheckInRecordPage(List<ActivityCheckInRecord> records, Long total) {
            this.records = records;
            this.total = total;
        }

        public List<ActivityCheckInRecord> getRecords() {
            return records;
        }

        public Long getTotal() {
            return total;
        }
    }

    private static class ActivityUserStateCache {
        private Boolean registered;
        private Boolean checkedIn;
        private Long voucherId;
        private String voucherDisplayCode;
        private String voucherStatus;
        private LocalDateTime voucherIssuedTime;
        private LocalDateTime voucherCheckedInTime;

        public Boolean getRegistered() {
            return registered;
        }

        public void setRegistered(Boolean registered) {
            this.registered = registered;
        }

        public Boolean getCheckedIn() {
            return checkedIn;
        }

        public void setCheckedIn(Boolean checkedIn) {
            this.checkedIn = checkedIn;
        }

        public Long getVoucherId() {
            return voucherId;
        }

        public void setVoucherId(Long voucherId) {
            this.voucherId = voucherId;
        }

        public String getVoucherDisplayCode() {
            return voucherDisplayCode;
        }

        public void setVoucherDisplayCode(String voucherDisplayCode) {
            this.voucherDisplayCode = voucherDisplayCode;
        }

        public String getVoucherStatus() {
            return voucherStatus;
        }

        public void setVoucherStatus(String voucherStatus) {
            this.voucherStatus = voucherStatus;
        }

        public LocalDateTime getVoucherIssuedTime() {
            return voucherIssuedTime;
        }

        public void setVoucherIssuedTime(LocalDateTime voucherIssuedTime) {
            this.voucherIssuedTime = voucherIssuedTime;
        }

        public LocalDateTime getVoucherCheckedInTime() {
            return voucherCheckedInTime;
        }

        public void setVoucherCheckedInTime(LocalDateTime voucherCheckedInTime) {
            this.voucherCheckedInTime = voucherCheckedInTime;
        }
    }
}
