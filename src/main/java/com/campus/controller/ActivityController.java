package com.campus.controller;

import com.campus.dto.ActivityCheckInCodeDTO;
import com.campus.dto.ActivityCheckInDTO;
import com.campus.dto.Result;
import com.campus.entity.Activity;
import com.campus.service.IActivityService;
import com.campus.service.OssService;
import com.campus.utils.SystemConstants;
import com.campus.utils.UserHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.Resource;

@RestController
@RequestMapping("/activity")
public class ActivityController {

    @Resource
    private IActivityService activityService;

    @Resource
    private OssService ossService;

    @GetMapping("/public/list")
    public Result queryPublicActivities(
            @RequestParam(value = "keyword", required = false) String keyword,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "status", required = false) Integer status,
            @RequestParam(value = "current", defaultValue = "1") Integer current,
            @RequestParam(value = "pageSize", defaultValue = "" + SystemConstants.MAX_PAGE_SIZE) Integer pageSize) {
        return activityService.queryPublicActivities(keyword, category, status, current, pageSize);
    }

    @GetMapping("/public/categories")
    public Result queryPublicCategories() {
        return activityService.queryPublicCategories();
    }

    @GetMapping("/public/{id}")
    public Result queryActivityDetail(@PathVariable("id") Long id) {
        return activityService.queryActivityDetail(id);
    }

    @PostMapping
    public Result createActivity(@RequestBody Activity activity) {
        return activityService.createActivity(activity);
    }

    @PutMapping
    public Result updateActivity(@RequestBody Activity activity) {
        return activityService.updateActivity(activity);
    }

    @GetMapping("/manage/mine")
    public Result queryMyCreatedActivities(
            @RequestParam(value = "current", defaultValue = "1") Integer current,
            @RequestParam(value = "pageSize", defaultValue = "" + SystemConstants.MAX_PAGE_SIZE) Integer pageSize) {
        return activityService.queryMyCreatedActivities(current, pageSize);
    }

    @PostMapping("/{id}/register")
    public Result register(@PathVariable("id") Long activityId) {
        return activityService.register(activityId);
    }

    @GetMapping("/registration/mine")
    public Result queryMyRegistrations(
            @RequestParam(value = "current", defaultValue = "1") Integer current,
            @RequestParam(value = "pageSize", defaultValue = "" + SystemConstants.MAX_PAGE_SIZE) Integer pageSize) {
        return activityService.queryMyRegistrations(current, pageSize);
    }

    @GetMapping("/manage/{id}/registrations")
    public Result queryActivityRegistrations(
            @PathVariable("id") Long activityId,
            @RequestParam(value = "current", defaultValue = "1") Integer current,
            @RequestParam(value = "pageSize", defaultValue = "" + SystemConstants.MAX_PAGE_SIZE) Integer pageSize) {
        return activityService.queryActivityRegistrations(activityId, current, pageSize);
    }

    @PostMapping("/manage/{id}/checkin-code")
    public Result updateCheckInCode(@PathVariable("id") Long activityId, @RequestBody ActivityCheckInCodeDTO dto) {
        return activityService.updateCheckInCode(activityId, dto);
    }

    @PostMapping("/manage/image")
    public Result uploadActivityImage(@RequestParam("file") MultipartFile file) {
        String url = ossService.uploadActivityImage(UserHolder.getUser().getId(), file);
        return Result.ok(url);
    }

    @PostMapping("/{id}/checkin")
    public Result checkIn(@PathVariable("id") Long activityId, @RequestBody ActivityCheckInDTO dto) {
        return activityService.checkIn(activityId, dto);
    }
}
