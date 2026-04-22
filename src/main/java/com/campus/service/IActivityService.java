package com.campus.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.campus.dto.ActivityCheckInVerifyDTO;
import com.campus.dto.Result;
import com.campus.entity.Activity;

public interface IActivityService extends IService<Activity> {

    Result queryPublicActivities(String keyword, String category, Integer status, Integer current, Integer pageSize);

    Result queryPublicCategories();

    Result queryActivityDetail(Long id);

    Result createActivity(Activity activity);

    Result updateActivity(Activity activity);

    Result queryMyCreatedActivities(Integer current, Integer pageSize);

    Result register(Long activityId);

    Result cancelRegistration(Long activityId);

    Result queryMyRegistrations(Integer current, Integer pageSize);

    Result queryActivityRegistrations(Long activityId, Integer current, Integer pageSize);

    Result verifyCheckIn(Long activityId, ActivityCheckInVerifyDTO dto, String idempotencyKey);

    Result queryCheckInStats(Long activityId);

    Result queryCheckInRecords(Long activityId, Integer current, Integer pageSize);
}
