package com.campus.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.campus.dto.ActivityCheckInCodeDTO;
import com.campus.dto.ActivityCheckInDTO;
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

    Result queryMyRegistrations(Integer current, Integer pageSize);

    Result queryActivityRegistrations(Long activityId, Integer current, Integer pageSize);

    Result updateCheckInCode(Long activityId, ActivityCheckInCodeDTO dto);

    Result checkIn(Long activityId, ActivityCheckInDTO dto);
}
