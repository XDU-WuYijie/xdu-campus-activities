package com.campus.service;

import com.campus.dto.ActivitySearchPageDTO;

import java.time.LocalDateTime;
import java.util.List;

public interface ActivitySearchService {

    ActivitySearchPageDTO searchActivities(String keyword,
                                           String category,
                                           Integer status,
                                           String location,
                                           String organizerName,
                                           String sortBy,
                                           LocalDateTime startTimeFrom,
                                           LocalDateTime startTimeTo,
                                           Integer current,
                                           Integer pageSize);

    List<String> queryCategories(Integer status);

    void syncActivity(Long activityId);

    boolean isAvailable();
}
