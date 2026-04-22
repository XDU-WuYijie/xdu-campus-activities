package com.campus.dto;

import lombok.Data;

@Data
public class UserDTO {
    public static final int ROLE_ORGANIZER = 1;
    public static final int ROLE_STUDENT = 2;

    private Long id;
    private String nickName;
    private String icon;
    private Integer roleType;
}
