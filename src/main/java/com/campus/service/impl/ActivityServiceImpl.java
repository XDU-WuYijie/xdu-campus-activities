package com.campus.service.impl;

import cn.hutool.core.util.RandomUtil;
import cn.hutool.core.util.StrUtil;
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
import com.campus.utils.SystemConstants;
import com.campus.utils.UserHolder;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ActivityServiceImpl extends ServiceImpl<ActivityMapper, Activity> implements IActivityService {

    private static final int STATUS_PUBLISHED = 2;
    private static final int REGISTRATION_ACTIVE = 1;
    private static final int CHECKED_IN = 1;
    private static final int CHECKIN_CODE_TTL_MINUTES = 180;

    @Resource
    private ActivityRegistrationMapper activityRegistrationMapper;

    @Resource
    private UserMapper userMapper;

    @Override
    public Result queryPublicActivities(String keyword, String category, Integer status, Integer current, Integer pageSize) {
        Integer targetStatus = status == null ? STATUS_PUBLISHED : status;
        QueryWrapper<Activity> wrapper = new QueryWrapper<>();
        wrapper.eq("status", targetStatus)
                .like(StrUtil.isNotBlank(keyword), "title", keyword)
                .eq(StrUtil.isNotBlank(category), "category", category)
                .orderByAsc("event_start_time")
                .orderByDesc("create_time");
        Page<Activity> page = page(new Page<>(current, normalizePageSize(pageSize)), wrapper);
        List<Activity> records = page.getRecords();
        enrichActivities(records, UserHolder.getUser());
        return Result.ok(records, page.getTotal());
    }

    @Override
    public Result queryPublicCategories() {
        QueryWrapper<Activity> wrapper = new QueryWrapper<>();
        wrapper.select("DISTINCT category")
                .isNotNull("category")
                .ne("category", "")
                .eq("status", STATUS_PUBLISHED)
                .orderByAsc("category");
        return Result.ok(listObjs(wrapper));
    }

    @Override
    public Result queryActivityDetail(Long id) {
        Activity activity = getById(id);
        if (activity == null) {
            return Result.fail("活动不存在");
        }
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
        if (!Boolean.TRUE.equals(activity.getCheckInEnabled())) {
            activity.setCheckInCode(null);
            activity.setCheckInCodeExpireTime(null);
        }
        save(activity);
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
        if (!Boolean.TRUE.equals(activity.getCheckInEnabled())) {
            existing.setCheckInCode(null);
            existing.setCheckInCodeExpireTime(null);
        }
        updateById(existing);
        return Result.ok();
    }

    @Override
    public Result queryMyCreatedActivities(Integer current, Integer pageSize) {
        Page<Activity> page = query()
                .eq("creator_id", UserHolder.getUser().getId())
                .orderByDesc("create_time")
                .page(new Page<>(current, normalizePageSize(pageSize)));
        List<Activity> records = page.getRecords();
        enrichActivities(records, UserHolder.getUser());
        return Result.ok(records, page.getTotal());
    }

    @Override
    @Transactional
    public Result register(Long activityId) {
        Activity activity = getById(activityId);
        if (activity == null) {
            return Result.fail("活动不存在");
        }
        if (!Objects.equals(activity.getStatus(), STATUS_PUBLISHED)) {
            return Result.fail("活动当前不可报名");
        }
        LocalDateTime now = LocalDateTime.now();
        if (activity.getRegistrationStartTime() != null && now.isBefore(activity.getRegistrationStartTime())) {
            return Result.fail("报名尚未开始");
        }
        if (activity.getRegistrationEndTime() != null && now.isAfter(activity.getRegistrationEndTime())) {
            return Result.fail("报名已经结束");
        }
        Long userId = UserHolder.getUser().getId();
        ActivityRegistration existing = activityRegistrationMapper.selectOne(new QueryWrapper<ActivityRegistration>()
                .eq("activity_id", activityId)
                .eq("user_id", userId));
        if (existing != null) {
            return Result.fail("你已经报过名了");
        }

        ActivityRegistration registration = new ActivityRegistration();
        registration.setActivityId(activityId);
        registration.setUserId(userId);
        registration.setStatus(REGISTRATION_ACTIVE);
        registration.setCheckInStatus(0);
        try {
            activityRegistrationMapper.insert(registration);
        } catch (DuplicateKeyException e) {
            return Result.fail("你已经报过名了");
        }

        UpdateWrapper<Activity> wrapper = new UpdateWrapper<>();
        wrapper.setSql("registered_count = registered_count + 1").eq("id", activityId);
        if (activity.getMaxParticipants() != null) {
            wrapper.lt("registered_count", activity.getMaxParticipants());
        }
        boolean updated = update(null, wrapper);
        if (!updated) {
            activityRegistrationMapper.deleteById(registration.getId());
            return Result.fail("活动名额已满");
        }
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
            activity.setRegistered(registration != null);
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
}
