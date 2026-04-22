package com.campus.websocket;

import cn.hutool.json.JSONUtil;
import com.campus.dto.ActivityRegistrationPushDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class ActivityRegistrationSessionRegistry {

    private final Map<Long, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public void register(Long userId, WebSocketSession session) {
        if (userId == null || session == null) {
            return;
        }
        sessions.put(userId, session);
    }

    public void unregister(Long userId, WebSocketSession session) {
        if (userId == null) {
            return;
        }
        if (session == null) {
            sessions.remove(userId);
            return;
        }
        sessions.remove(userId, session);
    }

    public void push(Long userId, ActivityRegistrationPushDTO payload) {
        if (userId == null || payload == null) {
            return;
        }
        WebSocketSession session = sessions.get(userId);
        if (session == null || !session.isOpen()) {
            return;
        }
        try {
            session.sendMessage(new TextMessage(JSONUtil.toJsonStr(payload)));
        } catch (IOException e) {
            log.warn("报名结果推送失败 userId={}", userId, e);
        }
    }
}
