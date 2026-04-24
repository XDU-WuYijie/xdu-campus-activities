SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `tb_activity` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `creator_id` bigint(20) unsigned NOT NULL COMMENT '创建人用户ID',
  `organizer_name` varchar(128) NOT NULL COMMENT '主办方名称',
  `title` varchar(255) NOT NULL COMMENT '活动标题',
  `cover_image` varchar(1024) DEFAULT NULL COMMENT '封面图',
  `images` varchar(4096) DEFAULT NULL COMMENT '活动图片，多个以逗号分隔',
  `summary` varchar(512) DEFAULT NULL COMMENT '活动摘要',
  `content` text COMMENT '活动详情',
  `category` varchar(64) NOT NULL COMMENT '活动分类',
  `registration_mode` varchar(64) NOT NULL DEFAULT 'AUDIT_REQUIRED' COMMENT '报名模式：AUDIT_REQUIRED/FIRST_COME_FIRST_SERVED',
  `location` varchar(255) NOT NULL COMMENT '活动地点',
  `max_participants` int(11) NOT NULL COMMENT '报名人数上限',
  `registered_count` int(11) NOT NULL DEFAULT 0 COMMENT '已报名人数',
  `registration_start_time` datetime NOT NULL COMMENT '报名开始时间',
  `registration_end_time` datetime NOT NULL COMMENT '报名结束时间',
  `event_start_time` datetime NOT NULL COMMENT '活动开始时间',
  `event_end_time` datetime NOT NULL COMMENT '活动结束时间',
  `check_in_enabled` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否启用签到',
  `check_in_code` varchar(64) DEFAULT NULL COMMENT '签到码',
  `check_in_code_expire_time` datetime DEFAULT NULL COMMENT '签到码过期时间',
  `status` tinyint(1) NOT NULL DEFAULT 2 COMMENT '状态：1待审核，2已发布，3已驳回，4强制下架，5下架待审核',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_activity_creator` (`creator_id`),
  KEY `idx_activity_category` (`category`),
  KEY `idx_activity_event_start` (`event_start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动表';

CREATE TABLE IF NOT EXISTS `tb_activity_registration` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键',
  `activity_id` bigint(20) unsigned NOT NULL COMMENT '活动ID',
  `user_id` bigint(20) unsigned NOT NULL COMMENT '用户ID',
  `status` tinyint(1) NOT NULL DEFAULT 0 COMMENT '报名状态：0报名待审核，1报名通过，2报名驳回，3已退出，4退出待审核',
  `request_id` varchar(64) DEFAULT NULL COMMENT '报名请求ID',
  `fail_reason` varchar(255) DEFAULT NULL COMMENT '失败原因',
  `voucher_id` bigint(20) unsigned DEFAULT NULL COMMENT '签到凭证ID',
  `check_in_status` tinyint(1) NOT NULL DEFAULT 0 COMMENT '签到状态：0未签到，1已签到',
  `check_in_time` datetime DEFAULT NULL COMMENT '签到时间',
  `confirm_time` datetime DEFAULT NULL COMMENT '最终确认时间',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_activity_user` (`activity_id`,`user_id`),
  KEY `idx_registration_voucher` (`voucher_id`),
  KEY `idx_registration_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动报名表';

CREATE TABLE IF NOT EXISTS `tb_activity_voucher` (
  `id` bigint(20) unsigned NOT NULL COMMENT '凭证ID',
  `display_code` varchar(32) NOT NULL COMMENT '展示码',
  `activity_id` bigint(20) unsigned NOT NULL COMMENT '活动ID',
  `registration_id` bigint(20) unsigned NOT NULL COMMENT '报名记录ID',
  `user_id` bigint(20) unsigned NOT NULL COMMENT '报名用户ID',
  `status` varchar(32) NOT NULL DEFAULT 'UNUSED' COMMENT '凭证状态：UNUSED/CHECKED_IN/CANCELED/EXPIRED',
  `issued_time` datetime NOT NULL COMMENT '签发时间',
  `checked_in_time` datetime DEFAULT NULL COMMENT '核销签到时间',
  `checked_in_by` bigint(20) unsigned DEFAULT NULL COMMENT '核销操作人ID',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_voucher_display_code` (`display_code`),
  UNIQUE KEY `uk_voucher_registration` (`registration_id`),
  KEY `idx_voucher_activity_user` (`activity_id`,`user_id`),
  KEY `idx_voucher_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动签到凭证表';

CREATE TABLE IF NOT EXISTS `tb_activity_check_in_record` (
  `id` bigint(20) unsigned NOT NULL COMMENT '主键',
  `activity_id` bigint(20) unsigned NOT NULL COMMENT '活动ID',
  `voucher_id` bigint(20) unsigned DEFAULT NULL COMMENT '凭证ID',
  `user_id` bigint(20) unsigned DEFAULT NULL COMMENT '报名用户ID',
  `operator_id` bigint(20) unsigned NOT NULL COMMENT '核销操作人ID',
  `result_status` varchar(64) NOT NULL COMMENT '核销结果',
  `request_key` varchar(128) DEFAULT NULL COMMENT '幂等请求Key',
  `request_fingerprint` varchar(128) DEFAULT NULL COMMENT '请求指纹',
  `response_body` varchar(2048) DEFAULT NULL COMMENT '响应摘要',
  `create_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_check_in_record_activity` (`activity_id`),
  KEY `idx_check_in_record_voucher` (`voucher_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活动签到核销记录表';

INSERT INTO `tb_activity` (`creator_id`, `organizer_name`, `title`, `cover_image`, `summary`, `content`, `category`, `registration_mode`, `location`, `max_participants`, `registered_count`, `registration_start_time`, `registration_end_time`, `event_start_time`, `event_end_time`, `check_in_enabled`, `status`)
SELECT 1, '西电校园活动中心', '2026 春季校园创客开放日', 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80', '面向全校开放的创客体验日，包含项目展示、社团互动与报名咨询。', '欢迎各学院同学参与创客开放日，现场可体验社团作品、了解大型活动组织流程，并领取后续活动报名指引。', '开放日', 'AUDIT_REQUIRED', '大学生活动中心一楼大厅', 200, 0, '2026-04-18 09:00:00', '2026-04-27 18:00:00', '2026-04-28 14:00:00', '2026-04-28 18:00:00', 0, 2
WHERE NOT EXISTS (SELECT 1 FROM `tb_activity` WHERE `title` = '2026 春季校园创客开放日');

INSERT INTO `tb_activity` (`creator_id`, `organizer_name`, `title`, `cover_image`, `summary`, `content`, `category`, `registration_mode`, `location`, `max_participants`, `registered_count`, `registration_start_time`, `registration_end_time`, `event_start_time`, `event_end_time`, `check_in_enabled`, `status`)
SELECT 1, '就业与实践服务站', '大型招聘会志愿者招募', 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80', '面向校园大型招聘会招募现场志愿者，支持报名与现场签到。', '志愿者将协助签到引导、秩序维护和咨询答疑，适合希望参与大型活动组织的同学报名。', '志愿服务', 'FIRST_COME_FIRST_SERVED', '南校区体育馆', 80, 0, '2026-04-20 08:00:00', '2026-04-25 20:00:00', '2026-04-30 08:30:00', '2026-04-30 18:00:00', 1, 2
WHERE NOT EXISTS (SELECT 1 FROM `tb_activity` WHERE `title` = '大型招聘会志愿者招募');

SET FOREIGN_KEY_CHECKS = 1;
