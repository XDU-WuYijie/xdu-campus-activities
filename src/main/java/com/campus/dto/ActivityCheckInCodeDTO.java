package com.campus.dto;

import lombok.Data;

@Data
public class ActivityCheckInCodeDTO {
    private String checkInCode;
    private Integer validMinutes;
}
