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
import com.campus.config.ActivityRegisterProperties;
import com.campus.config.ActivitySearchProperties;
import com.campus.dto.ActivityCheckInResultDTO;
import com.campus.dto.ActivityCheckInStatsDTO;
import com.campus.dto.ActivityCheckInVerifyDTO;
import com.campus.dto.ActivityRegisterResponseDTO;
import com.campus.dto.ActivitySearchPageDTO;
import com.campus.dto.ActivitySearchSyncEventDTO;
import com.campus.dto.ActivityRegistrationEventDTO;
import com.campus.dto.ActivityRegistrationPushDTO;
import com.campus.dto.ActivityRegistrationStatusDTO;
import com.campus.dto.Result;
import com.campus.dto.ReviewActionDTO;
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
import com.campus.service.ActivitySearchService;
import com.campus.service.IActivityService;
import com.campus.utils.CacheClient;
import com.campus.utils.AuthorizationUtils;
import com.campus.utils.RedisIdWorker;
import com.campus.utils.RbacConstants;
import com.campus.utils.SystemConstants;
import com.campus.utils.UserHolder;
import com.campus.websocket.ActivityRegistrationSessionRegistry;
import lombok.extern.slf4j.Slf4j;
import org.apache.rocketmq.spring.core.RocketMQTemplate;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import jakarta.annotation.Resource;
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
import static com.campus.utils.RedisConstants.ACTIVITY_FROZEN_KEY;
import static com.campus.utils.RedisConstants.ACTIVITY_META_KEY;
import static com.campus.utils.RedisConstants.ACTIVITY_REGISTER_USERS_KEY;
import static com.campus.utils.RedisConstants.ACTIVITY_STOCK_KEY;
import static com.campus.utils.RedisConstants.ACTIVITY_USER_REGISTER_STATE_KEY;
import static com.campus.utils.RedisConstants.ACTIVITY_USER_REGISTER_STATE_TTL_HOURS;
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

@Slf4j
@Service
public class ActivityServiceImpl extends ServiceImpl<ActivityMapper, Activity> implements IActivityService {

    private static final int STATUS_PENDING_REVIEW = 1;
    private static final int STATUS_PUBLISHED = 2;
    private static final int STATUS_REJECTED = 3;
    private static final int REGISTRATION_PENDING = 0;
    private static final int REGISTRATION_SUCCESS = 1;
    private static final int REGISTRATION_FAILED = 2;
    private static final int REGISTRATION_CANCELED = 3;
    private static final int CHECKED_IN = 1;
    private static final int CHECKED_OUT = 0;
    private static final String MY_REGISTRATION_FILTER_ALL = "ALL";
    private static final String MY_REGISTRATION_FILTER_PENDING_CHECK_IN = "PENDING_CHECK_IN";
    private static final String MY_REGISTRATION_FILTER_CHECKED_IN = "CHECKED_IN";
    private static final String MY_REGISTRATION_FILTER_FINISHED = "FINISHED";
    private static final String MY_REGISTRATION_FILTER_CANCELED = "CANCELED";
    private static final String REGISTRATION_STATUS_PENDING = "PENDING_CONFIRM";
    private static final String REGISTRATION_STATUS_SUCCESS = "SUCCESS";
    private static final String REGISTRATION_STATUS_FAILED = "FAILED";
    private static final String REGISTRATION_STATUS_CANCELED = "CANCELED";
    private static final String REGISTRATION_STATUS_NONE = "NOT_REGISTERED";
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

    @Resource
    private RocketMQTemplate rocketMQTemplate;

    @Resource
    private ActivityRegisterProperties activityRegisterProperties;

    @Resource
    private ActivityRegistrationSessionRegistry activityRegistrationSessionRegistry;

    @Resource
    private ActivitySearchService activitySearchService;

    @Resource
    private ActivitySearchProperties activitySearchProperties;

    @Override
    public Result queryPublicActivities(String keyword,
                                        String category,
                                        Integer status,
                                        String location,
                                        String organizerName,
                                        String sortBy,
                                        LocalDateTime startTimeFrom,
                                        LocalDateTime startTimeTo,
                                        Integer current,
                                        Integer pageSize) {
        List<Activity> records;
        Long total;
        try {
            if (activitySearchService.isAvailable()) {
                ActivitySearchPageDTO searchPage = activitySearchService.searchActivities(
                        keyword, category, status, location, organizerName, sortBy,
                        startTimeFrom, startTimeTo, current, pageSize);
                records = searchPage.getRecords();
                total = searchPage.getTotal();
            } else {
                CachedActivityPage cachedPage = queryCachedActivityPage(keyword, category, status, location,
                        organizerName, sortBy, startTimeFrom, startTimeTo, current, pageSize);
                records = cachedPage.getRecords();
                total = cachedPage.getTotal();
            }
        } catch (Exception e) {
            log.warn("活动列表 ES 查询失败，降级 MySQL keyword={}, category={}, sortBy={}",
                    keyword, category, sortBy, e);
            CachedActivityPage cachedPage = queryCachedActivityPage(keyword, category, status, location,
                    organizerName, sortBy, startTimeFrom, startTimeTo, current, pageSize);
            records = cachedPage.getRecords();
            total = cachedPage.getTotal();
        }
        syncRemainingSlots(records);
        enrichActivities(records, UserHolder.getUser());
        return Result.ok(records, total);
    }

    @Override
    public Result queryPublicCategories() {
        try {
            if (activitySearchService.isAvailable()) {
                return Result.ok(activitySearchService.queryCategories(STATUS_PUBLISHED));
            }
        } catch (Exception e) {
            log.warn("活动分类 ES 聚合失败，降级 MySQL", e);
        }
        return Result.ok(queryCachedCategories());
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
        UserDTO currentUser = UserHolder.getUser();
        boolean canViewUnpublished = currentUser != null
                && (Objects.equals(activity.getCreatorId(), currentUser.getId())
                || AuthorizationUtils.hasPermission(currentUser, RbacConstants.PERM_ACTIVITY_APPROVE));
        if (!Objects.equals(activity.getStatus(), STATUS_PUBLISHED) && !canViewUnpublished) {
            return Result.fail("活动尚未公开");
        }
        syncRemainingSlots(Collections.singletonList(activity));
        enrichActivities(Collections.singletonList(activity), currentUser);
        return Result.ok(activity);
    }

    @Override
    @Transactional
    public Result createActivity(Activity activity) {
        UserDTO user = UserHolder.getUser();
        Result authResult = requirePermission(RbacConstants.PERM_ACTIVITY_CREATE, "无权发起活动");
        if (authResult != null) {
            return authResult;
        }
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
            activity.setStatus(STATUS_PENDING_REVIEW);
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
        Result authResult = requirePermission(RbacConstants.PERM_ACTIVITY_UPDATE, "无权修改活动");
        if (authResult != null) {
            return authResult;
        }
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
        existing.setStatus(STATUS_PENDING_REVIEW);
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
        Result authResult = requirePermission(RbacConstants.PERM_ACTIVITY_CREATE, "无权查看我发起的活动");
        if (authResult != null) {
            return authResult;
        }
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
        Result authResult = requirePermission(RbacConstants.PERM_REGISTRATION_CREATE, "无权报名活动");
        if (authResult != null) {
            return authResult;
        }
        Activity activity = getById(activityId);
        if (activity == null) {
            return Result.fail("活动不存在");
        }
        UserDTO currentUser = UserHolder.getUser();
        ensureActivityRegistrationCache(activity);
        Long userId = currentUser.getId();
        String requestId = String.valueOf(redisIdWorker.nextId("activity-register"));
        Long result = stringRedisTemplate.execute(
                ACTIVITY_REGISTER_SCRIPT,
                Collections.emptyList(),
                activityId.toString(),
                userId.toString(),
                String.valueOf(LocalDateTime.now().toEpochSecond(ZoneOffset.UTC)),
                requestId
        );
        int code = result == null ? -1 : result.intValue();
        if (code == 0) {
            try {
                ActivityRegistrationEventDTO event = new ActivityRegistrationEventDTO();
                event.setActivityId(activityId);
                event.setUserId(userId);
                event.setRequestId(requestId);
                event.setCreateTime(LocalDateTime.now());
                rocketMQTemplate.convertAndSend(activityRegisterProperties.getTopic(), event);
                cachePendingRegistrationStatus(activityId, userId, requestId);
                return Result.ok(new ActivityRegisterResponseDTO(
                        activityId,
                        requestId,
                        REGISTRATION_STATUS_PENDING,
                        "报名确认中，请稍候"
                ));
            } catch (Exception e) {
                log.error("活动报名消息发送失败，执行缓存补偿 activityId={}, userId={}, requestId={}",
                        activityId, userId, requestId, e);
                rollbackReservation(activityId, userId, requestId, "报名失败，请稍后重试");
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
    public Result queryRegistrationStatus(Long activityId) {
        Result authResult = requirePermission(RbacConstants.PERM_REGISTRATION_VIEW_SELF, "无权查看报名状态");
        if (authResult != null) {
            return authResult;
        }
        Activity activity = getById(activityId);
        if (activity == null) {
            return Result.fail("活动不存在");
        }
        Long userId = UserHolder.getUser().getId();
        ActivityRegistrationStatusDTO status = resolveRegistrationStatus(activityId, userId);
        return Result.ok(status);
    }

    @Override
    @Transactional
    public Result cancelRegistration(Long activityId) {
        Result authResult = requirePermission(RbacConstants.PERM_REGISTRATION_CANCEL, "无权退出报名");
        if (authResult != null) {
            return authResult;
        }
        Activity activity = getById(activityId);
        if (activity == null) {
            return Result.fail("活动不存在");
        }
        UserDTO currentUser = UserHolder.getUser();
        LocalDateTime now = LocalDateTime.now();
        if (activity.getEventStartTime() != null && !now.isBefore(activity.getEventStartTime())) {
            return Result.fail("活动已开始，无法退出报名");
        }
        ActivityRegistration registration = activityRegistrationMapper.selectOne(new QueryWrapper<ActivityRegistration>()
                .eq("activity_id", activityId)
                .eq("user_id", currentUser.getId())
                .eq("status", REGISTRATION_SUCCESS));
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
        ActivityRegistration update = new ActivityRegistration();
        update.setId(registration.getId());
        update.setStatus(REGISTRATION_CANCELED);
        update.setFailReason("用户主动取消报名");
        update.setVoucherId(null);
        update.setConfirmTime(LocalDateTime.now());
        activityRegistrationMapper.updateById(update);
        UpdateWrapper<Activity> wrapper = new UpdateWrapper<>();
        wrapper.setSql("registered_count = registered_count - 1")
                .eq("id", activityId)
                .gt("registered_count", 0);
        update(null, wrapper);

        stringRedisTemplate.opsForSet().remove(activityRegisterUsersKey(activityId), currentUser.getId().toString());
        stringRedisTemplate.opsForValue().increment(activityStockKey(activityId));
        cacheCanceledRegistrationStatus(activityId, currentUser.getId(), registration.getRequestId(), "已退出活动");
        refreshActivityCacheState(activityId, false);
        return Result.ok();
    }

    @Override
    public Result queryMyRegistrations(String filter, Integer current, Integer pageSize) {
        Result authResult = requirePermission(RbacConstants.PERM_REGISTRATION_VIEW_SELF, "无权查看我的报名");
        if (authResult != null) {
            return authResult;
        }
        QueryWrapper<ActivityRegistration> wrapper = new QueryWrapper<ActivityRegistration>()
                .eq("user_id", UserHolder.getUser().getId())
                .orderByDesc("create_time");
        List<ActivityRegistration> records = activityRegistrationMapper.selectList(wrapper);
        enrichRegistrationActivities(records);
        enrichRegistrationVoucherInfo(records);
        List<ActivityRegistration> filteredRecords = filterMyRegistrations(records, filter);
        int normalizedPageSize = normalizePageSize(pageSize);
        int currentPage = current == null || current < 1 ? 1 : current;
        int fromIndex = Math.min((currentPage - 1) * normalizedPageSize, filteredRecords.size());
        int toIndex = Math.min(fromIndex + normalizedPageSize, filteredRecords.size());
        List<ActivityRegistration> pagedRecords = filteredRecords.subList(fromIndex, toIndex);
        return Result.ok(pagedRecords, (long) filteredRecords.size());
    }

    @Override
    public Result queryActivityRegistrations(Long activityId, Integer current, Integer pageSize) {
        Result authResult = requirePermission(RbacConstants.PERM_REGISTRATION_VIEW_ALL, "无权查看该活动报名名单");
        if (authResult != null) {
            return authResult;
        }
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
        Result authResult = requirePermission(RbacConstants.PERM_CHECKIN_VERIFY, "无权执行签到核销");
        if (authResult != null) {
            return authResult;
        }
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
        Result authResult = requirePermission(RbacConstants.PERM_CHECKIN_VIEW_RECORDS, "无权查看签到统计");
        if (authResult != null) {
            return authResult;
        }
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
        Result authResult = requirePermission(RbacConstants.PERM_CHECKIN_VIEW_RECORDS, "无权查看签到记录");
        if (authResult != null) {
            return authResult;
        }
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

    @Override
    public Result queryPendingReviewActivities() {
        List<Activity> activities = query()
                .eq("status", STATUS_PENDING_REVIEW)
                .orderByAsc("create_time")
                .list();
        if (activities.isEmpty()) {
            return Result.ok(Collections.emptyList());
        }
        List<Long> creatorIds = activities.stream().map(Activity::getCreatorId).filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, User> creatorMap = creatorIds.isEmpty() ? Collections.emptyMap() : userMapper.selectBatchIds(creatorIds)
                .stream().collect(Collectors.toMap(User::getId, item -> item));
        for (Activity activity : activities) {
            User creator = creatorMap.get(activity.getCreatorId());
            if (creator != null && StrUtil.isBlank(activity.getOrganizerName())) {
                activity.setOrganizerName(creator.getNickName());
            }
        }
        return Result.ok(activities);
    }

    @Override
    @Transactional
    public Result reviewActivity(Long activityId, ReviewActionDTO dto) {
        if (activityId == null) {
            return Result.fail("活动ID不能为空");
        }
        if (dto == null || dto.getApproved() == null) {
            return Result.fail("审核结果不能为空");
        }
        Activity activity = getById(activityId);
        if (activity == null) {
            return Result.fail("活动不存在");
        }
        activity.setStatus(Boolean.TRUE.equals(dto.getApproved()) ? STATUS_PUBLISHED : STATUS_REJECTED);
        updateById(activity);
        refreshActivityCacheState(activityId, true);
        return Result.ok();
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
        if (registration == null || !Objects.equals(registration.getStatus(), REGISTRATION_SUCCESS)) {
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
            boolean registered = userState != null && REGISTRATION_STATUS_SUCCESS.equals(userState.getStatus());
            if (!registered && user != null) {
                Boolean member = stringRedisTemplate.opsForSet().isMember(activityRegisterUsersKey(activity.getId()), user.getId().toString());
                registered = Boolean.TRUE.equals(member) && userState != null && REGISTRATION_STATUS_SUCCESS.equals(userState.getStatus());
            }
            activity.setRegistered(registered);
            activity.setCheckedIn(userState != null && Boolean.TRUE.equals(userState.getCheckedIn()));
            boolean canManage = user != null
                    && AuthorizationUtils.hasPermission(user, RbacConstants.PERM_ACTIVITY_UPDATE)
                    && Objects.equals(activity.getCreatorId(), user.getId());
            activity.setCanManage(canManage);
            activity.setRegistrationOpen(isRegistrationOpen(activity, now));
            activity.setRegistrationStatus(userState == null ? REGISTRATION_STATUS_NONE : userState.getStatus());
            activity.setRegistrationMessage(userState == null ? "未报名" : userState.getMessage());
            activity.setRegistrationRequestId(userState == null ? null : userState.getRequestId());
            activity.setRegistrationFailReason(userState == null ? null : userState.getFailReason());
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
            registration.setStatusText(readRegistrationStatusText(registration.getStatus()));
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
        Map<Long, ActivityUserStateCache> stateMap = new HashMap<>(activityIds.size());
        List<Long> missedActivityIds = new ArrayList<>();
        for (Long activityId : activityIds) {
            ActivityUserStateCache redisState = getUserStateFromRedis(activityId, userId);
            if (redisState == null) {
                missedActivityIds.add(activityId);
                continue;
            }
            stateMap.put(activityId, redisState);
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
            ActivityUserStateCache state = buildUserState(registration, voucher);
            stateMap.put(activityId, state);
            cacheUserRegistrationState(activityId, userId, state);
        }
        return stateMap;
    }

    private ActivityCheckInStatsDTO loadCheckInStats(Long activityId) {
        long registeredCount = activityRegistrationMapper.selectCount(new QueryWrapper<ActivityRegistration>()
                .eq("activity_id", activityId)
                .eq("status", REGISTRATION_SUCCESS));
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
                .map(activity -> activityStockKey(activity.getId()))
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
            String remainingValue = stringRedisTemplate.opsForValue().get(activityStockKey(activity.getId()));
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

    private CachedActivityPage queryCachedActivityPage(String keyword,
                                                       String category,
                                                       Integer status,
                                                       String location,
                                                       String organizerName,
                                                       String sortBy,
                                                       LocalDateTime startTimeFrom,
                                                       LocalDateTime startTimeTo,
                                                       Integer current,
                                                       Integer pageSize) {
        int normalizedPageSize = normalizePageSize(pageSize);
        int currentPage = current == null || current < 1 ? 1 : current;
        Integer targetStatus = status == null ? STATUS_PUBLISHED : status;
        String params = StrUtil.join("|",
                "status=" + targetStatus,
                "category=" + StrUtil.blankToDefault(category, ""),
                "keyword=" + StrUtil.blankToDefault(keyword, ""),
                "location=" + StrUtil.blankToDefault(location, ""),
                "organizerName=" + StrUtil.blankToDefault(organizerName, ""),
                "sortBy=" + StrUtil.blankToDefault(sortBy, ""),
                "startTimeFrom=" + (startTimeFrom == null ? "" : startTimeFrom),
                "startTimeTo=" + (startTimeTo == null ? "" : startTimeTo),
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
                .like(StrUtil.isNotBlank(location), "location", location)
                .like(StrUtil.isNotBlank(organizerName), "organizer_name", organizerName)
                .ge(startTimeFrom != null, "event_start_time", startTimeFrom)
                .le(startTimeTo != null, "event_start_time", startTimeTo);
        applyMysqlFallbackSort(wrapper, sortBy);
        Page<Activity> page = page(new Page<>(currentPage, normalizedPageSize), wrapper);

        Map<String, Object> cacheValue = new HashMap<>(2);
        cacheValue.put("total", page.getTotal());
        cacheValue.put("records", page.getRecords());
        stringRedisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(cacheValue), CACHE_ACTIVITY_LIST_TTL, TimeUnit.MINUTES);
        return new CachedActivityPage(page.getRecords(), page.getTotal());
    }

    private List<ActivityRegistration> filterMyRegistrations(List<ActivityRegistration> records, String filter) {
        String targetFilter = StrUtil.blankToDefault(StrUtil.trim(filter), MY_REGISTRATION_FILTER_ALL).toUpperCase();
        if (MY_REGISTRATION_FILTER_ALL.equals(targetFilter)) {
            return records;
        }
        LocalDateTime now = LocalDateTime.now();
        return records.stream()
                .filter(record -> matchesMyRegistrationFilter(record, targetFilter, now))
                .collect(Collectors.toList());
    }

    private boolean matchesMyRegistrationFilter(ActivityRegistration record, String filter, LocalDateTime now) {
        if (record == null) {
            return false;
        }
        if (MY_REGISTRATION_FILTER_CANCELED.equals(filter)) {
            return Objects.equals(record.getStatus(), REGISTRATION_CANCELED);
        }
        if (MY_REGISTRATION_FILTER_PENDING_CHECK_IN.equals(filter)) {
            return Objects.equals(record.getStatus(), REGISTRATION_SUCCESS)
                    && !Objects.equals(record.getCheckInStatus(), CHECKED_IN)
                    && (record.getEventEndTime() == null || !now.isAfter(record.getEventEndTime()));
        }
        if (MY_REGISTRATION_FILTER_CHECKED_IN.equals(filter)) {
            return Objects.equals(record.getStatus(), REGISTRATION_SUCCESS)
                    && Objects.equals(record.getCheckInStatus(), CHECKED_IN);
        }
        if (MY_REGISTRATION_FILTER_FINISHED.equals(filter)) {
            return record.getEventEndTime() != null && now.isAfter(record.getEventEndTime());
        }
        return true;
    }

    private List<String> queryCachedCategories() {
        String key = CACHE_ACTIVITY_CATEGORIES_KEY;
        String categoriesJson = stringRedisTemplate.opsForValue().get(key);
        if (StrUtil.isNotBlank(categoriesJson)) {
            return JSONUtil.parseArray(categoriesJson).toList(String.class);
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
        return categories;
    }

    private void applyMysqlFallbackSort(QueryWrapper<Activity> wrapper, String sortBy) {
        String targetSort = StrUtil.blankToDefault(sortBy, "composite");
        if ("publishTimeDesc".equals(targetSort)) {
            wrapper.orderByDesc("create_time");
            return;
        }
        if ("signupCountDesc".equals(targetSort) || "heatScoreDesc".equals(targetSort)) {
            wrapper.orderByDesc("registered_count").orderByDesc("create_time");
            return;
        }
        wrapper.orderByAsc("event_start_time").orderByDesc("create_time");
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
            dispatchActivitySearchSyncEvent(activityId, "DELETE");
            return;
        }
        evictActivityCache(activityId, evictCategoryCache);
        initActivityRegistrationCache(latest);
        dispatchActivitySearchSyncEvent(activityId, evictCategoryCache ? "UPSERT" : "STATE_REFRESH");
    }

    private void dispatchActivitySearchSyncEvent(Long activityId, String trigger) {
        if (activityId == null || StrUtil.isBlank(activitySearchProperties.getSync().getTopic())) {
            return;
        }
        Runnable action = () -> sendActivitySearchSyncEvent(activityId, trigger);
        if (TransactionSynchronizationManager.isSynchronizationActive()
                && TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
            return;
        }
        action.run();
    }

    private void sendActivitySearchSyncEvent(Long activityId, String trigger) {
        ActivitySearchSyncEventDTO event = new ActivitySearchSyncEventDTO();
        event.setActivityId(activityId);
        event.setTrigger(trigger);
        event.setEventTime(LocalDateTime.now());
        try {
            rocketMQTemplate.convertAndSend(activitySearchProperties.getSync().getTopic(), event);
        } catch (Exception e) {
            log.warn("发送活动搜索索引同步消息失败，改走本地补偿 activityId={}, trigger={}",
                    activityId, trigger, e);
            try {
                if (activitySearchService.isAvailable()) {
                    activitySearchService.syncActivity(activityId);
                }
            } catch (Exception syncException) {
                log.error("本地补偿同步活动搜索索引失败 activityId={}", activityId, syncException);
            }
        }
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
        stringRedisTemplate.opsForHash().putAll(activityMetaKey(activity.getId()), meta);

        List<ActivityRegistration> registrations = activityRegistrationMapper.selectList(new QueryWrapper<ActivityRegistration>()
                .eq("activity_id", activity.getId()));
        int successCount = (int) registrations.stream()
                .filter(item -> Objects.equals(item.getStatus(), REGISTRATION_SUCCESS))
                .count();
        int pendingCount = (int) registrations.stream()
                .filter(item -> Objects.equals(item.getStatus(), REGISTRATION_PENDING))
                .count();
        int maxParticipants = activity.getMaxParticipants() == null ? 0 : activity.getMaxParticipants();
        int remainingSlots = Math.max(maxParticipants - successCount - pendingCount, 0);
        stringRedisTemplate.opsForValue().set(activityStockKey(activity.getId()), String.valueOf(remainingSlots));
        stringRedisTemplate.opsForValue().set(activityFrozenKey(activity.getId()), String.valueOf(Math.max(pendingCount, 0)));

        String usersKey = activityRegisterUsersKey(activity.getId());
        stringRedisTemplate.delete(usersKey);
        if (!registrations.isEmpty()) {
            String[] userIds = registrations.stream()
                    .filter(item -> Objects.equals(item.getStatus(), REGISTRATION_SUCCESS)
                            || Objects.equals(item.getStatus(), REGISTRATION_PENDING))
                    .map(ActivityRegistration::getUserId)
                    .filter(Objects::nonNull)
                    .map(String::valueOf)
                    .toArray(String[]::new);
            if (userIds.length > 0) {
                stringRedisTemplate.opsForSet().add(usersKey, userIds);
            }
            Map<Long, ActivityVoucher> voucherMap = activityVoucherMapper.selectList(new QueryWrapper<ActivityVoucher>()
                            .eq("activity_id", activity.getId()))
                    .stream()
                    .collect(Collectors.toMap(ActivityVoucher::getRegistrationId, v -> v, (a, b) -> a));
            for (ActivityRegistration registration : registrations) {
                ActivityUserStateCache state = buildUserState(registration, voucherMap.get(registration.getId()));
                cacheUserRegistrationState(activity.getId(), registration.getUserId(), state);
            }
        }
    }

    @Transactional
    public void confirmRegistration(ActivityRegistrationEventDTO event) {
        if (event == null || event.getActivityId() == null || event.getUserId() == null || StrUtil.isBlank(event.getRequestId())) {
            return;
        }
        Long activityId = event.getActivityId();
        Long userId = event.getUserId();
        String requestId = event.getRequestId();
        Activity activity = getById(activityId);
        if (activity == null || !Objects.equals(activity.getStatus(), STATUS_PUBLISHED)) {
            finalizeRegistrationFailure(activityId, userId, requestId, "活动不存在或已下线");
            return;
        }
        try {
            ActivityRegistrationStatusDTO status = transactionTemplate.execute(tx -> saveRegistrationRecord(activity, userId, requestId));
            if (status == null) {
                finalizeRegistrationFailure(activityId, userId, requestId, "报名失败，请稍后重试");
                return;
            }
            publishRegistrationResult(userId, status);
        } catch (Exception e) {
            log.error("活动报名确认失败 activityId={}, userId={}, requestId={}", activityId, userId, requestId, e);
            finalizeRegistrationFailure(activityId, userId, requestId, "报名失败，请稍后重试");
        }
    }

    private ActivityRegistrationStatusDTO saveRegistrationRecord(Activity activity, Long userId, String requestId) {
        ActivityRegistration existing = activityRegistrationMapper.selectOne(new QueryWrapper<ActivityRegistration>()
                .eq("activity_id", activity.getId())
                .eq("user_id", userId));
        boolean shouldIncreaseRegisteredCount = false;
        ActivityRegistration registration;
        if (existing != null && Objects.equals(existing.getStatus(), REGISTRATION_SUCCESS)) {
            ActivityVoucher voucher = ensureVoucherForRegistration(existing);
            ActivityRegistrationStatusDTO status = buildRegistrationStatus(existing, voucher);
            cacheFinalRegistrationStatus(activity.getId(), userId, status);
            refreshActivityCacheState(activity.getId(), false);
            return status;
        }
        if (existing == null) {
            registration = new ActivityRegistration();
            registration.setActivityId(activity.getId());
            registration.setUserId(userId);
            registration.setStatus(REGISTRATION_SUCCESS);
            registration.setRequestId(requestId);
            registration.setFailReason(null);
            registration.setCheckInStatus(CHECKED_OUT);
            registration.setConfirmTime(LocalDateTime.now());
            try {
                activityRegistrationMapper.insert(registration);
            } catch (DuplicateKeyException e) {
                existing = activityRegistrationMapper.selectOne(new QueryWrapper<ActivityRegistration>()
                        .eq("activity_id", activity.getId())
                        .eq("user_id", userId));
                if (existing == null) {
                    throw e;
                }
                registration = existing;
                shouldIncreaseRegisteredCount = !Objects.equals(existing.getStatus(), REGISTRATION_SUCCESS);
            }
            if (existing == null) {
                shouldIncreaseRegisteredCount = true;
            }
        } else {
            registration = existing;
            shouldIncreaseRegisteredCount = !Objects.equals(existing.getStatus(), REGISTRATION_SUCCESS);
            ActivityRegistration update = new ActivityRegistration();
            update.setId(existing.getId());
            update.setStatus(REGISTRATION_SUCCESS);
            update.setRequestId(requestId);
            update.setFailReason(null);
            update.setCheckInStatus(CHECKED_OUT);
            update.setConfirmTime(LocalDateTime.now());
            activityRegistrationMapper.updateById(update);
            registration.setStatus(REGISTRATION_SUCCESS);
            registration.setRequestId(requestId);
            registration.setFailReason(null);
            registration.setCheckInStatus(CHECKED_OUT);
            registration.setConfirmTime(update.getConfirmTime());
        }

        if (shouldIncreaseRegisteredCount) {
            UpdateWrapper<Activity> wrapper = new UpdateWrapper<>();
            wrapper.setSql("registered_count = registered_count + 1")
                    .eq("id", activity.getId())
                    .lt("registered_count", activity.getMaxParticipants());
            boolean updated = update(null, wrapper);
            if (!updated) {
                throw new IllegalStateException("活动报名落库时名额不足");
            }
        }
        ActivityVoucher voucher = ensureVoucherForRegistration(registration);
        registration.setVoucherId(voucher.getId());
        activityRegistrationMapper.updateById(registration);
        ActivityRegistrationStatusDTO status = buildRegistrationStatus(registration, voucher);
        stringRedisTemplate.opsForValue().decrement(activityFrozenKey(activity.getId()));
        cacheFinalRegistrationStatus(activity.getId(), userId, status);
        refreshActivityCacheState(activity.getId(), false);
        return status;
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

    private void rollbackReservation(Long activityId, Long userId, String requestId, String reason) {
        stringRedisTemplate.opsForValue().increment(activityStockKey(activityId));
        stringRedisTemplate.opsForValue().decrement(activityFrozenKey(activityId));
        stringRedisTemplate.opsForSet().remove(activityRegisterUsersKey(activityId), userId.toString());
        ActivityUserStateCache state = new ActivityUserStateCache();
        state.setStatus(REGISTRATION_STATUS_FAILED);
        state.setRequestId(requestId);
        state.setMessage(reason);
        state.setFailReason(reason);
        state.setRegistered(false);
        cacheUserRegistrationState(activityId, userId, state);
        evictActivityCache(activityId, false);
    }

    private void finalizeRegistrationFailure(Long activityId, Long userId, String requestId, String reason) {
        transactionTemplate.executeWithoutResult(tx -> {
            ActivityRegistration existing = activityRegistrationMapper.selectOne(new QueryWrapper<ActivityRegistration>()
                    .eq("activity_id", activityId)
                    .eq("user_id", userId));
            if (existing == null) {
                ActivityRegistration registration = new ActivityRegistration();
                registration.setActivityId(activityId);
                registration.setUserId(userId);
                registration.setStatus(REGISTRATION_FAILED);
                registration.setRequestId(requestId);
                registration.setFailReason(reason);
                registration.setCheckInStatus(CHECKED_OUT);
                registration.setConfirmTime(LocalDateTime.now());
                activityRegistrationMapper.insert(registration);
            } else {
                ActivityRegistration update = new ActivityRegistration();
                update.setId(existing.getId());
                update.setStatus(REGISTRATION_FAILED);
                update.setRequestId(requestId);
                update.setFailReason(reason);
                update.setConfirmTime(LocalDateTime.now());
                activityRegistrationMapper.updateById(update);
            }
        });
        rollbackReservation(activityId, userId, requestId, reason);
        ActivityRegistrationStatusDTO status = resolveRegistrationStatus(activityId, userId);
        publishRegistrationResult(userId, status);
    }

    private void publishRegistrationResult(Long userId, ActivityRegistrationStatusDTO status) {
        if (status == null) {
            return;
        }
        ActivityRegistrationPushDTO push = new ActivityRegistrationPushDTO();
        push.setEvent("activity_register_result");
        push.setPayload(status);
        activityRegistrationSessionRegistry.push(userId, push);
    }

    private ActivityRegistrationStatusDTO buildRegistrationStatus(ActivityRegistration registration, ActivityVoucher voucher) {
        ActivityRegistrationStatusDTO status = new ActivityRegistrationStatusDTO();
        if (registration != null) {
            status.setActivityId(registration.getActivityId());
            status.setUserId(registration.getUserId());
            status.setRequestId(registration.getRequestId());
            status.setStatus(mapRegistrationStatus(registration.getStatus()));
            status.setFailReason(registration.getFailReason());
            status.setConfirmTime(registration.getConfirmTime());
            status.setMessage(buildRegistrationMessage(registration.getStatus(), registration.getFailReason()));
        }
        if (voucher != null) {
            status.setVoucherId(voucher.getId());
            status.setVoucherDisplayCode(voucher.getDisplayCode());
            status.setVoucherStatus(voucher.getStatus());
            status.setVoucherIssuedTime(voucher.getIssuedTime());
            status.setVoucherCheckedInTime(voucher.getCheckedInTime());
        }
        return status;
    }

    private ActivityRegistrationStatusDTO resolveRegistrationStatus(Long activityId, Long userId) {
        ActivityUserStateCache redisState = getUserStateFromRedis(activityId, userId);
        if (redisState != null) {
            return buildRegistrationStatus(redisState, activityId, userId);
        }
        ActivityRegistration registration = activityRegistrationMapper.selectOne(new QueryWrapper<ActivityRegistration>()
                .eq("activity_id", activityId)
                .eq("user_id", userId));
        if (registration == null) {
            ActivityRegistrationStatusDTO status = new ActivityRegistrationStatusDTO();
            status.setActivityId(activityId);
            status.setUserId(userId);
            status.setStatus(REGISTRATION_STATUS_NONE);
            status.setMessage("未报名");
            return status;
        }
        ActivityVoucher voucher = registration.getVoucherId() == null ? null : activityVoucherMapper.selectById(registration.getVoucherId());
        ActivityUserStateCache state = buildUserState(registration, voucher);
        cacheUserRegistrationState(activityId, userId, state);
        return buildRegistrationStatus(registration, voucher);
    }

    private ActivityRegistrationStatusDTO buildRegistrationStatus(ActivityUserStateCache state, Long activityId, Long userId) {
        ActivityRegistrationStatusDTO status = new ActivityRegistrationStatusDTO();
        status.setActivityId(activityId);
        status.setUserId(userId);
        status.setRequestId(state.getRequestId());
        status.setStatus(state.getStatus());
        status.setMessage(state.getMessage());
        status.setFailReason(state.getFailReason());
        status.setVoucherId(state.getVoucherId());
        status.setVoucherDisplayCode(state.getVoucherDisplayCode());
        status.setVoucherStatus(state.getVoucherStatus());
        status.setConfirmTime(state.getConfirmTime());
        status.setVoucherIssuedTime(state.getVoucherIssuedTime());
        status.setVoucherCheckedInTime(state.getVoucherCheckedInTime());
        return status;
    }

    private void cachePendingRegistrationStatus(Long activityId, Long userId, String requestId) {
        ActivityUserStateCache state = new ActivityUserStateCache();
        state.setStatus(REGISTRATION_STATUS_PENDING);
        state.setRequestId(requestId);
        state.setMessage("报名确认中，请稍候");
        state.setRegistered(false);
        cacheUserRegistrationState(activityId, userId, state);
    }

    private void cacheFinalRegistrationStatus(Long activityId, Long userId, ActivityRegistrationStatusDTO dto) {
        ActivityUserStateCache state = new ActivityUserStateCache();
        state.setStatus(dto.getStatus());
        state.setRequestId(dto.getRequestId());
        state.setMessage(dto.getMessage());
        state.setFailReason(dto.getFailReason());
        state.setVoucherId(dto.getVoucherId());
        state.setVoucherDisplayCode(dto.getVoucherDisplayCode());
        state.setVoucherStatus(dto.getVoucherStatus());
        state.setConfirmTime(dto.getConfirmTime());
        state.setVoucherIssuedTime(dto.getVoucherIssuedTime());
        state.setVoucherCheckedInTime(dto.getVoucherCheckedInTime());
        state.setRegistered(REGISTRATION_STATUS_SUCCESS.equals(dto.getStatus()));
        state.setCheckedIn(VOUCHER_STATUS_CHECKED_IN.equals(dto.getVoucherStatus()));
        cacheUserRegistrationState(activityId, userId, state);
    }

    private void cacheCanceledRegistrationStatus(Long activityId, Long userId, String requestId, String message) {
        ActivityUserStateCache state = new ActivityUserStateCache();
        state.setStatus(REGISTRATION_STATUS_CANCELED);
        state.setRequestId(requestId);
        state.setMessage(message);
        state.setRegistered(false);
        cacheUserRegistrationState(activityId, userId, state);
    }

    private ActivityUserStateCache buildUserState(ActivityRegistration registration, ActivityVoucher voucher) {
        ActivityUserStateCache state = new ActivityUserStateCache();
        if (registration == null) {
            state.setStatus(REGISTRATION_STATUS_NONE);
            state.setMessage("未报名");
            state.setRegistered(false);
            state.setCheckedIn(false);
            return state;
        }
        state.setStatus(mapRegistrationStatus(registration.getStatus()));
        state.setRequestId(registration.getRequestId());
        state.setMessage(buildRegistrationMessage(registration.getStatus(), registration.getFailReason()));
        state.setFailReason(registration.getFailReason());
        state.setConfirmTime(registration.getConfirmTime());
        state.setRegistered(Objects.equals(registration.getStatus(), REGISTRATION_SUCCESS));
        state.setCheckedIn(voucher != null && VOUCHER_STATUS_CHECKED_IN.equals(voucher.getStatus()));
        state.setVoucherId(voucher == null ? null : voucher.getId());
        state.setVoucherDisplayCode(voucher == null ? null : voucher.getDisplayCode());
        state.setVoucherStatus(voucher == null ? null : voucher.getStatus());
        state.setVoucherIssuedTime(voucher == null ? null : voucher.getIssuedTime());
        state.setVoucherCheckedInTime(voucher == null ? null : voucher.getCheckedInTime());
        return state;
    }

    private ActivityUserStateCache getUserStateFromRedis(Long activityId, Long userId) {
        Map<Object, Object> stateMap = stringRedisTemplate.opsForHash().entries(activityUserStateKey(activityId, userId));
        if (stateMap == null || stateMap.isEmpty()) {
            return null;
        }
        ActivityUserStateCache state = new ActivityUserStateCache();
        state.setStatus((String) stateMap.get("status"));
        state.setRequestId((String) stateMap.get("requestId"));
        state.setMessage((String) stateMap.get("message"));
        state.setFailReason((String) stateMap.get("failReason"));
        state.setRegistered(Boolean.valueOf(String.valueOf(stateMap.getOrDefault("registered", "false"))));
        state.setCheckedIn(Boolean.valueOf(String.valueOf(stateMap.getOrDefault("checkedIn", "false"))));
        state.setVoucherId(parseLongValue(stateMap.get("voucherId")));
        state.setVoucherDisplayCode((String) stateMap.get("voucherDisplayCode"));
        state.setVoucherStatus((String) stateMap.get("voucherStatus"));
        state.setConfirmTime(parseDateTimeValue(stateMap.get("confirmTime")));
        state.setVoucherIssuedTime(parseDateTimeValue(stateMap.get("voucherIssuedTime")));
        state.setVoucherCheckedInTime(parseDateTimeValue(stateMap.get("voucherCheckedInTime")));
        return state;
    }

    private void cacheUserRegistrationState(Long activityId, Long userId, ActivityUserStateCache state) {
        if (activityId == null || userId == null || state == null) {
            return;
        }
        Map<String, String> payload = new HashMap<>();
        payload.put("status", StrUtil.blankToDefault(state.getStatus(), REGISTRATION_STATUS_NONE));
        payload.put("requestId", StrUtil.blankToDefault(state.getRequestId(), ""));
        payload.put("message", StrUtil.blankToDefault(state.getMessage(), ""));
        payload.put("failReason", StrUtil.blankToDefault(state.getFailReason(), ""));
        payload.put("registered", String.valueOf(Boolean.TRUE.equals(state.getRegistered())));
        payload.put("checkedIn", String.valueOf(Boolean.TRUE.equals(state.getCheckedIn())));
        payload.put("voucherId", state.getVoucherId() == null ? "" : state.getVoucherId().toString());
        payload.put("voucherDisplayCode", StrUtil.blankToDefault(state.getVoucherDisplayCode(), ""));
        payload.put("voucherStatus", StrUtil.blankToDefault(state.getVoucherStatus(), ""));
        payload.put("confirmTime", state.getConfirmTime() == null ? "" : state.getConfirmTime().toString());
        payload.put("voucherIssuedTime", state.getVoucherIssuedTime() == null ? "" : state.getVoucherIssuedTime().toString());
        payload.put("voucherCheckedInTime", state.getVoucherCheckedInTime() == null ? "" : state.getVoucherCheckedInTime().toString());
        stringRedisTemplate.opsForHash().putAll(activityUserStateKey(activityId, userId), payload);
        stringRedisTemplate.expire(activityUserStateKey(activityId, userId), ACTIVITY_USER_REGISTER_STATE_TTL_HOURS, TimeUnit.HOURS);
    }

    private String mapRegistrationStatus(Integer status) {
        if (Objects.equals(status, REGISTRATION_PENDING)) {
            return REGISTRATION_STATUS_PENDING;
        }
        if (Objects.equals(status, REGISTRATION_SUCCESS)) {
            return REGISTRATION_STATUS_SUCCESS;
        }
        if (Objects.equals(status, REGISTRATION_FAILED)) {
            return REGISTRATION_STATUS_FAILED;
        }
        if (Objects.equals(status, REGISTRATION_CANCELED)) {
            return REGISTRATION_STATUS_CANCELED;
        }
        return REGISTRATION_STATUS_NONE;
    }

    private String buildRegistrationMessage(Integer status, String failReason) {
        if (Objects.equals(status, REGISTRATION_PENDING)) {
            return "报名确认中，请稍候";
        }
        if (Objects.equals(status, REGISTRATION_SUCCESS)) {
            return "报名成功";
        }
        if (Objects.equals(status, REGISTRATION_FAILED)) {
            return StrUtil.isBlank(failReason) ? "报名失败，请稍后重试" : failReason;
        }
        if (Objects.equals(status, REGISTRATION_CANCELED)) {
            return "已退出活动";
        }
        return "未报名";
    }

    private String readRegistrationStatusText(Integer status) {
        if (Objects.equals(status, REGISTRATION_PENDING)) {
            return "报名确认中";
        }
        if (Objects.equals(status, REGISTRATION_SUCCESS)) {
            return "报名成功";
        }
        if (Objects.equals(status, REGISTRATION_FAILED)) {
            return "报名失败";
        }
        if (Objects.equals(status, REGISTRATION_CANCELED)) {
            return "已取消";
        }
        return "未知状态";
    }

    private Long parseLongValue(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString();
        return StrUtil.isBlank(text) ? null : Long.valueOf(text);
    }

    private LocalDateTime parseDateTimeValue(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString();
        return StrUtil.isBlank(text) ? null : LocalDateTime.parse(text);
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
        java.util.Set<String> userStateKeys = stringRedisTemplate.keys(activityUserStatePattern(activityId));
        if (userStateKeys != null && !userStateKeys.isEmpty()) {
            stringRedisTemplate.delete(userStateKeys);
        }
        java.util.Set<String> recordKeys = stringRedisTemplate.keys(CACHE_ACTIVITY_CHECK_IN_RECORDS_KEY + activityId + ":*");
        if (recordKeys != null && !recordKeys.isEmpty()) {
            stringRedisTemplate.delete(recordKeys);
        }
        stringRedisTemplate.delete(CACHE_ACTIVITY_CHECK_IN_STATS_KEY + activityId);
        stringRedisTemplate.delete(activityMetaKey(activityId));
        stringRedisTemplate.delete(activityStockKey(activityId));
        stringRedisTemplate.delete(activityFrozenKey(activityId));
        stringRedisTemplate.delete(activityRegisterUsersKey(activityId));
    }

    private String activityUserStateKey(Long activityId, Long userId) {
        return ACTIVITY_USER_REGISTER_STATE_KEY + activityId + ":" + userId;
    }

    private String activityUserStatePattern(Long activityId) {
        return ACTIVITY_USER_REGISTER_STATE_KEY + activityId + ":*";
    }

    private String activityCheckInRecordsKey(Long activityId, Integer current, Integer pageSize) {
        return CACHE_ACTIVITY_CHECK_IN_RECORDS_KEY + activityId + ":" + current + ":" + pageSize;
    }

    private String activityMetaKey(Long activityId) {
        return ACTIVITY_META_KEY + activityId;
    }

    private String activityStockKey(Long activityId) {
        return ACTIVITY_STOCK_KEY + activityId;
    }

    private String activityFrozenKey(Long activityId) {
        return ACTIVITY_FROZEN_KEY + activityId;
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

    private Result requirePermission(String permissionCode, String failMessage) {
        UserDTO user = UserHolder.getUser();
        if (AuthorizationUtils.hasPermission(user, permissionCode)) {
            return null;
        }
        return Result.fail(failMessage);
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
        private String status;
        private String message;
        private String requestId;
        private String failReason;
        private Long voucherId;
        private String voucherDisplayCode;
        private String voucherStatus;
        private LocalDateTime confirmTime;
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

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public String getRequestId() {
            return requestId;
        }

        public void setRequestId(String requestId) {
            this.requestId = requestId;
        }

        public String getFailReason() {
            return failReason;
        }

        public void setFailReason(String failReason) {
            this.failReason = failReason;
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

        public LocalDateTime getConfirmTime() {
            return confirmTime;
        }

        public void setConfirmTime(LocalDateTime confirmTime) {
            this.confirmTime = confirmTime;
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
