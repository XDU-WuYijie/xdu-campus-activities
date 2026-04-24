SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `tb_activity` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `creator_id` bigint unsigned NOT NULL,
  `organizer_name` varchar(128) NOT NULL,
  `title` varchar(255) NOT NULL,
  `cover_image` varchar(1024) DEFAULT NULL,
  `images` varchar(4096) DEFAULT NULL,
  `summary` varchar(512) DEFAULT NULL,
  `content` text,
  `activity_flow` text COMMENT '活动流程',
  `faq` text COMMENT '常见问题',
  `category` varchar(64) NOT NULL,
  `custom_category` varchar(64) DEFAULT NULL COMMENT '自定义活动类型，仅 category=其他 时使用',
  `registration_mode` varchar(64) NOT NULL DEFAULT 'AUDIT_REQUIRED' COMMENT '报名模式：AUDIT_REQUIRED/FIRST_COME_FIRST_SERVED',
  `contact_info` varchar(255) DEFAULT NULL COMMENT '主办方联系方式',
  `location` varchar(255) NOT NULL,
  `max_participants` int NOT NULL,
  `registered_count` int NOT NULL DEFAULT 0,
  `registration_start_time` datetime NOT NULL,
  `registration_end_time` datetime NOT NULL,
  `event_start_time` datetime NOT NULL,
  `event_end_time` datetime NOT NULL,
  `check_in_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `check_in_code` varchar(64) DEFAULT NULL,
  `check_in_code_expire_time` datetime DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 2 COMMENT '状态：1待审核，2已发布，3已驳回，4强制下架，5下架待审核',
  `reviewer_id` bigint unsigned DEFAULT NULL COMMENT '审核人ID',
  `review_remark` varchar(512) DEFAULT NULL COMMENT '审核备注/驳回原因',
  `review_time` datetime DEFAULT NULL COMMENT '审核时间',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_creator` (`creator_id`),
  KEY `idx_activity_category` (`category`),
  KEY `idx_activity_event_start` (`event_start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tb_activity_registration` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `activity_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 0 COMMENT '报名状态：0报名待审核，1报名通过，2报名驳回，3已退出，4退出待审核',
  `request_id` varchar(64) DEFAULT NULL,
  `fail_reason` varchar(255) DEFAULT NULL,
  `voucher_id` bigint unsigned DEFAULT NULL,
  `check_in_status` tinyint(1) NOT NULL DEFAULT 0,
  `check_in_time` datetime DEFAULT NULL,
  `confirm_time` datetime DEFAULT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_activity_user` (`activity_id`,`user_id`),
  KEY `idx_registration_user` (`user_id`),
  KEY `idx_registration_voucher` (`voucher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tb_activity_voucher` (
  `id` bigint unsigned NOT NULL,
  `display_code` varchar(32) NOT NULL,
  `activity_id` bigint unsigned NOT NULL,
  `registration_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'UNUSED',
  `issued_time` datetime NOT NULL,
  `checked_in_time` datetime DEFAULT NULL,
  `checked_in_by` bigint unsigned DEFAULT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_voucher_display_code` (`display_code`),
  UNIQUE KEY `uk_voucher_registration` (`registration_id`),
  KEY `idx_voucher_activity_user` (`activity_id`,`user_id`),
  KEY `idx_voucher_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tb_activity_check_in_record` (
  `id` bigint unsigned NOT NULL,
  `activity_id` bigint unsigned NOT NULL,
  `voucher_id` bigint unsigned DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `operator_id` bigint unsigned NOT NULL,
  `result_status` varchar(64) NOT NULL,
  `request_key` varchar(128) DEFAULT NULL,
  `request_fingerprint` varchar(128) DEFAULT NULL,
  `response_body` varchar(2048) DEFAULT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_check_in_record_activity` (`activity_id`),
  KEY `idx_check_in_record_voucher` (`voucher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tb_activity_favorite` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `activity_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_activity_favorite_user_activity` (`user_id`,`activity_id`),
  KEY `idx_activity_favorite_activity` (`activity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动收藏表';

CREATE TABLE IF NOT EXISTS `tb_sign` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `year` year NOT NULL,
  `month` tinyint NOT NULL,
  `date` date NOT NULL,
  `is_backup` tinyint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tb_user` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `phone` varchar(11) NOT NULL,
  `username` varchar(64) DEFAULT NULL,
  `password` varchar(128) DEFAULT '',
  `nick_name` varchar(32) DEFAULT '',
  `icon` varchar(255) DEFAULT '',
  `role_type` tinyint(1) NOT NULL DEFAULT 2,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniqe_key_phone` (`phone`),
  UNIQUE KEY `uk_tb_user_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tb_user_info` (
  `user_id` bigint unsigned NOT NULL,
  `city` varchar(64) DEFAULT '',
  `college` varchar(64) DEFAULT '',
  `grade` varchar(32) DEFAULT '',
  `mentor` varchar(64) DEFAULT '',
  `introduce` varchar(128) DEFAULT NULL,
  `fans` int unsigned DEFAULT 0,
  `followee` int unsigned DEFAULT 0,
  `gender` tinyint unsigned DEFAULT 0,
  `birthday` date DEFAULT NULL,
  `credits` int unsigned DEFAULT 0,
  `level` tinyint unsigned DEFAULT 0,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `organizer_apply` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `apply_status` varchar(32) NOT NULL DEFAULT 'PENDING',
  `org_name` varchar(128) NOT NULL,
  `reason` varchar(512) DEFAULT NULL,
  `reviewer_id` bigint unsigned DEFAULT NULL,
  `review_remark` varchar(255) DEFAULT NULL,
  `review_time` datetime DEFAULT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_organizer_apply_user` (`user_id`),
  KEY `idx_organizer_apply_status` (`apply_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_role` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role_code` varchar(64) NOT NULL,
  `role_name` varchar(128) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_role_code` (`role_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_permission` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `permission_code` varchar(128) NOT NULL,
  `permission_name` varchar(128) NOT NULL,
  `permission_type` varchar(32) NOT NULL DEFAULT 'API',
  `path` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_permission_code` (`permission_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_user_role` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `role_id` bigint unsigned NOT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_user_role` (`user_id`,`role_id`),
  KEY `idx_sys_user_role_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_role_permission` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role_id` bigint unsigned NOT NULL,
  `permission_id` bigint unsigned NOT NULL,
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sys_role_permission` (`role_id`,`permission_id`),
  KEY `idx_sys_role_permission_permission` (`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_notification` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `receiver_user_id` bigint unsigned NOT NULL,
  `receiver_role_code` varchar(64) DEFAULT NULL,
  `title` varchar(128) NOT NULL,
  `content` varchar(1024) NOT NULL DEFAULT '',
  `type` varchar(64) NOT NULL,
  `biz_type` varchar(64) DEFAULT NULL,
  `biz_id` bigint unsigned DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `read_time` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notification_receiver_read` (`receiver_user_id`,`is_read`,`created_at`),
  KEY `idx_notification_type` (`type`),
  KEY `idx_notification_biz` (`biz_type`,`biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sys_review_record` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `reviewer_user_id` bigint unsigned NOT NULL,
  `reviewer_role_code` varchar(64) NOT NULL,
  `review_type` varchar(64) NOT NULL,
  `biz_type` varchar(64) NOT NULL,
  `biz_id` bigint unsigned DEFAULT NULL,
  `biz_title` varchar(255) NOT NULL DEFAULT '',
  `target_user_id` bigint unsigned DEFAULT NULL,
  `target_name` varchar(128) DEFAULT '',
  `action` varchar(32) NOT NULL,
  `remark` varchar(512) DEFAULT '',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_review_record_reviewer` (`reviewer_user_id`,`review_type`,`created_at`),
  KEY `idx_review_record_biz` (`biz_type`,`biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `tb_ai_review_record` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `activity_id` bigint unsigned NOT NULL,
  `task_status` varchar(32) NOT NULL DEFAULT 'PENDING',
  `suggestion` varchar(32) NOT NULL DEFAULT 'UNKNOWN',
  `risk_level` varchar(32) NOT NULL DEFAULT 'UNKNOWN',
  `score` int DEFAULT NULL,
  `problems_json` text,
  `missing_fields_json` text,
  `similar_activities_json` text,
  `similarity_analysis` varchar(1024) DEFAULT NULL,
  `review_comment` varchar(2048) DEFAULT NULL,
  `model_name` varchar(128) DEFAULT NULL,
  `prompt_version` varchar(64) NOT NULL DEFAULT 'v1',
  `raw_response` text,
  `parse_status` varchar(32) NOT NULL DEFAULT 'PARSED',
  `error_message` varchar(1024) DEFAULT NULL,
  `manual_review_result` varchar(32) DEFAULT NULL,
  `manual_review_remark` varchar(512) DEFAULT NULL,
  `manual_reviewed_at` datetime DEFAULT NULL,
  `is_ai_adopted` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ai_review_activity_prompt` (`activity_id`,`prompt_version`),
  KEY `idx_ai_review_status` (`task_status`,`updated_at`),
  KEY `idx_ai_review_activity` (`activity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `sys_role` (`role_code`, `role_name`, `description`, `status`) VALUES
('USER', '普通用户', '可浏览活动、报名、查看个人报名与签到状态', 1),
('ACTIVITY_ADMIN', '活动管理员', '可发起活动、查看报名名单、执行签到核销', 1),
('PLATFORM_ADMIN', '平台管理员', '可做平台级活动审核、主办方申请审核和活动治理', 1)
ON DUPLICATE KEY UPDATE
`role_name` = VALUES(`role_name`),
`description` = VALUES(`description`),
`status` = VALUES(`status`);

INSERT INTO `sys_permission` (`permission_code`, `permission_name`, `permission_type`, `path`, `description`, `status`) VALUES
('activity:view', '查看活动', 'API', '/activity/public/*', '活动浏览', 1),
('activity:search', '搜索活动', 'API', '/activity/public/list', '活动搜索', 1),
('activity:create', '发起活动', 'API', '/activity', '创建活动', 1),
('activity:update', '编辑活动', 'API', '/activity', '编辑自己创建的活动', 1),
('activity:approve', '审核活动', 'API', NULL, '审核活动发布与下架申请', 1),
('activity:offline', '下架活动', 'API', NULL, '强制下架已发布活动', 1),
('activity:manage_category', '管理活动分类', 'API', NULL, '活动分类治理', 1),
('registration:create', '报名活动', 'API', '/activity/{id}/register', '创建报名', 1),
('registration:cancel', '退出报名', 'API', '/activity/{id}/register', '取消报名', 1),
('registration:view_self', '查看自己的报名', 'API', '/activity/registration/mine', '查看个人报名', 1),
('registration:view_all', '查看活动报名名单', 'API', '/activity/manage/{id}/registrations', '查看活动报名名单', 1),
('registration:export', '导出报名名单', 'API', NULL, '导出报名名单', 1),
('checkin:view_self', '查看自己的签到状态', 'API', '/activity/{id}/register/status', '查看个人签到凭证和状态', 1),
('checkin:open', '开启签到', 'API', NULL, '活动签到配置', 1),
('checkin:close', '关闭签到', 'API', NULL, '关闭签到', 1),
('checkin:verify', '核销签到', 'API', '/activity/manage/{id}/check-in/verify', '执行签到核销', 1),
('checkin:view_records', '查看签到记录', 'API', '/activity/manage/{id}/check-in/*', '查看签到统计与记录', 1),
('checkin:export', '导出签到名单', 'API', NULL, '导出签到记录', 1),
('notification:view_self', '查看个人通知', 'API', NULL, '查看个人通知', 1),
('notification:send_activity', '发送活动通知', 'API', NULL, '发送活动通知', 1),
('notification:publish_platform', '发布平台公告', 'API', NULL, '发布平台公告', 1),
('platform:user_manage', '管理用户', 'API', NULL, '平台用户治理', 1),
('platform:role_assign', '分配角色', 'API', NULL, '角色绑定与调整', 1),
('platform:statistics:view', '查看平台统计', 'API', NULL, '平台统计查看', 1),
('platform:auditlog:view', '查看审计日志', 'API', NULL, '查看审计日志', 1)
ON DUPLICATE KEY UPDATE
`permission_name` = VALUES(`permission_name`),
`permission_type` = VALUES(`permission_type`),
`path` = VALUES(`path`),
`description` = VALUES(`description`),
`status` = VALUES(`status`);

INSERT IGNORE INTO `sys_role_permission` (`role_id`, `permission_id`)
SELECT r.`id`, p.`id`
FROM `sys_role` r
JOIN `sys_permission` p
WHERE (
  r.`role_code` = 'USER'
  AND p.`permission_code` IN (
    'activity:view',
    'activity:search',
    'registration:create',
    'registration:cancel',
    'registration:view_self',
    'checkin:view_self',
    'notification:view_self'
  )
) OR (
  r.`role_code` = 'ACTIVITY_ADMIN'
  AND p.`permission_code` IN (
    'activity:view',
    'activity:search',
    'activity:create',
    'activity:update',
    'registration:view_all',
    'registration:export',
    'checkin:open',
    'checkin:close',
    'checkin:verify',
    'checkin:view_records',
    'checkin:export',
    'notification:send_activity'
  )
) OR (
  r.`role_code` = 'PLATFORM_ADMIN'
  AND p.`permission_code` IN (
    'activity:view',
    'activity:approve',
    'activity:offline',
    'activity:manage_category',
    'platform:user_manage',
    'platform:role_assign',
    'platform:statistics:view',
    'platform:auditlog:view',
    'notification:publish_platform'
  )
);

INSERT INTO `tb_user` (`phone`, `username`, `password`, `nick_name`, `icon`, `role_type`)
SELECT '10000000001', 'admin', '123456', '平台管理员', '', 2
WHERE NOT EXISTS (SELECT 1 FROM `tb_user` WHERE `username` = 'admin');

INSERT INTO `tb_user` (`phone`, `username`, `password`, `nick_name`, `icon`, `role_type`)
SELECT '10000000003', 'test', '123456', '西电活动中心', '', 1
WHERE NOT EXISTS (SELECT 1 FROM `tb_user` WHERE `username` = 'test');

INSERT INTO `tb_user_info` (`user_id`, `city`, `college`, `grade`, `mentor`, `introduce`, `gender`, `birthday`)
SELECT u.`id`, '西安', '党委学生工作部', '2026', '', '负责校园大型活动、志愿服务和文化项目组织。', 0, '2000-01-01'
FROM `tb_user` u
LEFT JOIN `tb_user_info` ui ON ui.`user_id` = u.`id`
WHERE u.`username` = 'test'
  AND ui.`user_id` IS NULL;

INSERT IGNORE INTO `sys_user_role` (`user_id`, `role_id`)
SELECT u.`id`, r.`id`
FROM `tb_user` u
JOIN `sys_role` r ON r.`role_code` = 'PLATFORM_ADMIN'
WHERE u.`username` = 'admin';

INSERT IGNORE INTO `sys_user_role` (`user_id`, `role_id`)
SELECT u.`id`, r.`id`
FROM `tb_user` u
JOIN `sys_role` r ON r.`role_code` = 'ACTIVITY_ADMIN'
WHERE u.`username` = 'test';

INSERT IGNORE INTO `sys_user_role` (`user_id`, `role_id`)
SELECT u.`id`, r.`id`
FROM `tb_user` u
JOIN `sys_role` r ON r.`role_code` = 'USER'
WHERE u.`username` IN ('test');

INSERT INTO `tb_activity` (`creator_id`, `organizer_name`, `title`, `cover_image`, `images`, `summary`, `content`, `category`, `registration_mode`, `location`, `max_participants`, `registered_count`, `registration_start_time`, `registration_end_time`, `event_start_time`, `event_end_time`, `check_in_enabled`, `status`)
SELECT u.`id`, '西电活动中心', '星火创新实践开放日',
       'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
       'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
       '面向全校同学开放的创新实践展示与体验活动。',
       '开放日设置项目路演、创客工坊体验、实验室参观和社团交流环节。参与同学可近距离了解校园创新团队的项目成果，也可以现场咨询后续加入方式。',
       '创新实践', 'AUDIT_REQUIRED', '南校区大学生活动中心一楼大厅', 180, 0,
       '2026-05-01 09:00:00', '2026-05-10 18:00:00', '2026-05-12 14:00:00', '2026-05-12 18:00:00', 1, 2
FROM `tb_user` u
WHERE u.`username` = 'test'
  AND NOT EXISTS (SELECT 1 FROM `tb_activity` WHERE `title` = '星火创新实践开放日');

INSERT INTO `tb_activity` (`creator_id`, `organizer_name`, `title`, `cover_image`, `images`, `summary`, `content`, `category`, `registration_mode`, `location`, `max_participants`, `registered_count`, `registration_start_time`, `registration_end_time`, `event_start_time`, `event_end_time`, `check_in_enabled`, `status`)
SELECT u.`id`, '西电活动中心', '毕业季草坪音乐会',
       'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
       'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80',
       '毕业季校园音乐会，开放报名并凭签到凭证入场。',
       '活动邀请校园乐队、合唱团和毕业生代表参与演出。现场按报名签到入场，请同学们提前完成报名并保留签到凭证。',
       '文艺活动', 'FIRST_COME_FIRST_SERVED', '北校区中心草坪', 300, 0,
       '2026-05-05 08:00:00', '2026-05-25 20:00:00', '2026-05-30 19:00:00', '2026-05-30 21:30:00', 1, 2
FROM `tb_user` u
WHERE u.`username` = 'test'
  AND NOT EXISTS (SELECT 1 FROM `tb_activity` WHERE `title` = '毕业季草坪音乐会');

INSERT INTO `tb_activity` (`creator_id`, `organizer_name`, `title`, `cover_image`, `images`, `summary`, `content`, `category`, `registration_mode`, `location`, `max_participants`, `registered_count`, `registration_start_time`, `registration_end_time`, `event_start_time`, `event_end_time`, `check_in_enabled`, `status`)
SELECT u.`id`, '西电活动中心', '校园招聘会志愿者集训',
       'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80',
       'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
       '为大型校园招聘会招募并培训现场志愿者。',
       '集训内容包括签到引导、会场分流、企业接待、突发情况上报流程。完成培训并签到的同学将进入招聘会志愿者排班名单。',
       '志愿服务', 'AUDIT_REQUIRED', '南校区体育馆会议室', 90, 0,
       '2026-04-28 09:00:00', '2026-05-06 18:00:00', '2026-05-09 09:00:00', '2026-05-09 12:00:00', 1, 2
FROM `tb_user` u
WHERE u.`username` = 'test'
  AND NOT EXISTS (SELECT 1 FROM `tb_activity` WHERE `title` = '校园招聘会志愿者集训');

INSERT INTO `tb_activity` (`creator_id`, `organizer_name`, `title`, `cover_image`, `images`, `summary`, `content`, `category`, `registration_mode`, `location`, `max_participants`, `registered_count`, `registration_start_time`, `registration_end_time`, `event_start_time`, `event_end_time`, `check_in_enabled`, `status`)
SELECT u.`id`, '西电活动中心', '网络安全攻防体验营',
       'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
       'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
       '零基础可参加的网络安全攻防体验活动。',
       '体验营包含基础安全讲解、靶场演示、分组任务和导师答疑。活动适合对网络安全方向感兴趣、希望了解竞赛训练路径的同学。',
       '竞赛训练', 'FIRST_COME_FIRST_SERVED', '网安大楼 C305 实训室', 60, 0,
       '2026-05-10 09:00:00', '2026-05-18 18:00:00', '2026-05-21 14:00:00', '2026-05-21 17:30:00', 1, 1
FROM `tb_user` u
WHERE u.`username` = 'test'
  AND NOT EXISTS (SELECT 1 FROM `tb_activity` WHERE `title` = '网络安全攻防体验营');

INSERT INTO `tb_activity` (`creator_id`, `organizer_name`, `title`, `cover_image`, `images`, `summary`, `content`, `category`, `registration_mode`, `location`, `max_participants`, `registered_count`, `registration_start_time`, `registration_end_time`, `event_start_time`, `event_end_time`, `check_in_enabled`, `status`)
SELECT u.`id`, '西电活动中心', '秦岭环保公益行',
       'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80',
       'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
       '面向学生志愿者的户外环保公益活动。',
       '活动计划开展环保宣讲、步道垃圾清理和自然观察记录。因出行安排调整，主办方已提交下架申请，等待平台管理员审核。',
       '公益活动', 'AUDIT_REQUIRED', '秦岭生态保护实践基地', 45, 0,
       '2026-05-12 09:00:00', '2026-05-22 18:00:00', '2026-05-26 08:00:00', '2026-05-26 17:00:00', 1, 5
FROM `tb_user` u
WHERE u.`username` = 'test'
  AND NOT EXISTS (SELECT 1 FROM `tb_activity` WHERE `title` = '秦岭环保公益行');

INSERT INTO `tb_activity` (`creator_id`, `organizer_name`, `title`, `cover_image`, `images`, `summary`, `content`, `category`, `registration_mode`, `location`, `max_participants`, `registered_count`, `registration_start_time`, `registration_end_time`, `event_start_time`, `event_end_time`, `check_in_enabled`, `status`)
WITH RECURSIVE seq(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 295
)
SELECT u.`id`,
       '西电活动中心',
       CONCAT(
         CASE MOD(n, 10)
           WHEN 0 THEN '秦岭生态公益实践'
           WHEN 1 THEN '校园创新工坊开放日'
           WHEN 2 THEN '大型活动志愿者训练营'
           WHEN 3 THEN '毕业季草坪音乐会'
           WHEN 4 THEN '网络安全竞赛体验营'
           WHEN 5 THEN '社区公益服务行动'
           WHEN 6 THEN '智能硬件创客挑战'
           WHEN 7 THEN '校园迎新志愿服务'
           WHEN 8 THEN '青年艺术展演活动'
           ELSE '算法挑战赛训练营'
         END,
         ' 第', n, '期'
       ),
       CASE MOD(n, 10)
         WHEN 0 THEN 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80'
         WHEN 1 THEN 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80'
         WHEN 2 THEN 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80'
         WHEN 3 THEN 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80'
         WHEN 4 THEN 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80'
         WHEN 5 THEN 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80'
         WHEN 6 THEN 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80'
         WHEN 7 THEN 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80'
         WHEN 8 THEN 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80'
         ELSE 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80'
       END,
       CASE MOD(n, 10)
         WHEN 0 THEN 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80'
         WHEN 1 THEN 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80'
         WHEN 2 THEN 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80'
         WHEN 3 THEN 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80'
         WHEN 4 THEN 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80'
         WHEN 5 THEN 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80'
         WHEN 6 THEN 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80'
         WHEN 7 THEN 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=80'
         WHEN 8 THEN 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80'
         ELSE 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80'
       END,
       CASE MOD(n, 5)
         WHEN 0 THEN '面向全校学生的公益实践项目，包含志愿服务、环保行动与社区协作。'
         WHEN 1 THEN '聚焦创新实践和团队协作，适合希望了解校园项目孵化的同学参加。'
         WHEN 2 THEN '大型校园活动现场服务训练，覆盖签到、引导、秩序维护和应急沟通。'
         WHEN 3 THEN '校园文化艺术活动，包含演出、展演、互动体验和现场签到。'
         ELSE '竞赛训练与能力提升活动，包含讲解、实操、分组任务和导师答疑。'
       END,
       CONCAT('本活动由西电活动中心组织，设置报名审核和现场签到环节。活动第', n, '期将围绕主题开展分组实践、经验分享和成果交流，报名通过后请按时到场签到。'),
       CASE MOD(n, 5)
         WHEN 0 THEN '公益活动'
         WHEN 1 THEN '创新实践'
         WHEN 2 THEN '志愿服务'
         WHEN 3 THEN '文艺活动'
         ELSE '竞赛训练'
       END,
       CASE MOD(n, 3)
         WHEN 0 THEN 'FIRST_COME_FIRST_SERVED'
         ELSE 'AUDIT_REQUIRED'
       END,
       CASE MOD(n, 8)
         WHEN 0 THEN '南校区大学生活动中心一楼大厅'
         WHEN 1 THEN '北校区中心草坪'
         WHEN 2 THEN '南校区体育馆会议室'
         WHEN 3 THEN '网安大楼 C305 实训室'
         WHEN 4 THEN '创新创业学院路演厅'
         WHEN 5 THEN '教学楼 B203'
         WHEN 6 THEN '图书馆报告厅'
         ELSE '秦岭生态保护实践基地'
       END,
       40 + MOD(n * 7, 260),
       0,
       DATE_ADD('2026-05-01 09:00:00', INTERVAL n DAY),
       DATE_ADD('2026-05-05 18:00:00', INTERVAL n DAY),
       DATE_ADD('2026-05-08 14:00:00', INTERVAL n DAY),
       DATE_ADD('2026-05-08 17:00:00', INTERVAL n DAY),
       1,
       CASE WHEN MOD(n, 20) = 0 THEN 1 WHEN MOD(n, 25) = 0 THEN 5 ELSE 2 END
FROM seq
JOIN `tb_user` u ON u.`username` = 'test'
WHERE NOT EXISTS (SELECT 1 FROM `tb_activity` WHERE `title` = CONCAT('校园创新工坊开放日 第1期'));

SET FOREIGN_KEY_CHECKS = 1;
