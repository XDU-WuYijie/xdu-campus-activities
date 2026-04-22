package com.campus.utils;

public class RedisConstants {
    public static final String LOGIN_CODE_KEY = "login:code:";
    public static final Long LOGIN_CODE_TTL = 2L;
    public static final String LOGIN_USER_KEY = "login:token:";
    public static final Long LOGIN_USER_TTL = 36000L;

    public static final Long CACHE_NULL_TTL = 2L;

    public static final Long CACHE_SHOP_TTL = 30L;
    public static final String CACHE_SHOP_KEY = "cache:shop:";
    public static final String CACHE_ACTIVITY_DETAIL_KEY = "cache:activity:detail:";
    public static final Long CACHE_ACTIVITY_DETAIL_TTL = 10L;
    public static final String CACHE_ACTIVITY_LIST_KEY = "cache:activity:list:";
    public static final Long CACHE_ACTIVITY_LIST_TTL = 1L;
    public static final String CACHE_ACTIVITY_CATEGORIES_KEY = "cache:activity:categories:";
    public static final Long CACHE_ACTIVITY_CATEGORIES_TTL = 30L;
    public static final String CACHE_ACTIVITY_USER_STATE_KEY = "cache:activity:user-state:";
    public static final Long CACHE_ACTIVITY_USER_STATE_TTL = 5L;
    public static final String CACHE_ACTIVITY_CHECK_IN_STATS_KEY = "cache:activity:check-in:stats:";
    public static final Long CACHE_ACTIVITY_CHECK_IN_STATS_TTL = 5L;
    public static final String CACHE_ACTIVITY_CHECK_IN_RECORDS_KEY = "cache:activity:check-in:records:";
    public static final Long CACHE_ACTIVITY_CHECK_IN_RECORDS_TTL = 3L;
    public static final String ACTIVITY_META_KEY = "activity:meta:";
    public static final String ACTIVITY_SLOTS_KEY = "activity:slots:";
    public static final String ACTIVITY_REGISTER_USERS_KEY = "activity:register:users:";
    public static final String ACTIVITY_REGISTRATION_STREAM_KEY = "stream.activity.registration";
    public static final String ACTIVITY_REGISTRATION_GROUP = "g1";
    public static final String ACTIVITY_REGISTRATION_CONSUMER = "c1";
    public static final String ACTIVITY_VOUCHER_DISPLAY_KEY = "activity:voucher:display:";
    public static final String ACTIVITY_CHECK_IN_IDEMPOTENCY_KEY = "activity:checkin:idempotency:";
    public static final Long ACTIVITY_CHECK_IN_IDEMPOTENCY_TTL_MINUTES = 10L;

    public static final String LOCK_SHOP_KEY = "lock:shop:";
    public static final Long LOCK_SHOP_TTL = 10L;

    public static final String SECKILL_STOCK_KEY = "seckill:stock:";
    public static final String BLOG_LIKED_KEY = "blog:liked:";
    public static final String FEED_KEY = "feed:";
    public static final String USER_SIGN_KEY = "sign:";
}
