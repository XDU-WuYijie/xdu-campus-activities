package com.campus.service;

import cn.hutool.core.util.StrUtil;
import com.aliyun.oss.OSS;
import com.aliyun.oss.model.ObjectMetadata;
import com.aliyun.oss.model.PutObjectRequest;
import com.campus.config.OssProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OssService {

    private final OSS oss;
    private final OssProperties properties;

    public String uploadAvatar(Long userId, MultipartFile file) {
        return uploadImage(userId, file, properties.getAvatarPrefix(), "头像");
    }

    public String uploadActivityImage(Long userId, MultipartFile file) {
        return uploadImage(userId, file, properties.getActivityPrefix(), "活动图片");
    }

    private String uploadImage(Long userId, MultipartFile file, String prefixSetting, String bizName) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("请选择要上传的" + bizName + "文件");
        }
        String originalFilename = file.getOriginalFilename();
        String suffix = StrUtil.subAfter(originalFilename, ".", true);
        if (StrUtil.isBlank(suffix)) {
            suffix = "jpg";
        }

        String prefix = normalizePrefix(prefixSetting);
        String datePart = LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE);
        String key = prefix + userId + "/" + datePart + "/" + UUID.randomUUID().toString().replace("-", "") + "." + suffix;

        try (InputStream in = file.getInputStream()) {
            ObjectMetadata metadata = new ObjectMetadata();
            if (file.getSize() > 0) {
                metadata.setContentLength(file.getSize());
            }
            if (StrUtil.isNotBlank(file.getContentType())) {
                metadata.setContentType(file.getContentType());
            }
            PutObjectRequest request = new PutObjectRequest(properties.getBucket(), key, in, metadata);
            oss.putObject(request);
        } catch (IOException e) {
            throw new RuntimeException(bizName + "上传失败", e);
        }

        return buildPublicUrl(properties.getBucket(), properties.getEndpoint(), key);
    }

    private static String normalizePrefix(String prefix) {
        if (StrUtil.isBlank(prefix)) {
            return "";
        }
        String p = prefix.trim();
        while (p.startsWith("/")) {
            p = p.substring(1);
        }
        if (!p.isEmpty() && !p.endsWith("/")) {
            p = p + "/";
        }
        return p;
    }

    private static String buildPublicUrl(String bucket, String endpoint, String key) {
        String ep = endpoint == null ? "" : endpoint.trim();
        if (ep.startsWith("http://")) {
            ep = ep.substring("http://".length());
        } else if (ep.startsWith("https://")) {
            ep = ep.substring("https://".length());
        }
        String k = key;
        while (k.startsWith("/")) {
            k = k.substring(1);
        }
        return "https://" + bucket + "." + ep + "/" + k;
    }
}

