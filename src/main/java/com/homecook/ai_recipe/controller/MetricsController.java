package com.homecook.ai_recipe.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api/metrics")
public class MetricsController {

    private final StringRedisTemplate redis;

    public MetricsController(StringRedisTemplate redis) {
        this.redis = redis;
    }

    private String readVuid(HttpServletRequest req) {
        if (req.getCookies() != null) {
            for (Cookie c : req.getCookies()) {
                if ("vuid".equals(c.getName())) return c.getValue();
            }
        }
        return UUID.randomUUID().toString().replace("-", "");
    }

    @PostMapping("/hit")
    public ResponseEntity<Map<String, Long>> hit(HttpServletRequest req) {
        String vuid = readVuid(req);
        LocalDate today = LocalDate.now();
        String keyTotal = "RF:metrics:total_pv";
        String keyDailyUV = "RF:metrics:daily_uv:" + today;
        String keyDedupe = "RF:metrics:dedupe:" + today + ":" + vuid;

        // 전체 방문수
        Long total = redis.opsForValue().increment(keyTotal);

        // 오늘 방문 중복방지 (오늘 1회만 증가)
        Boolean isFirst = redis.opsForValue().setIfAbsent(keyDedupe, "1", Duration.ofDays(2));
        if (Boolean.TRUE.equals(isFirst)) {
            redis.opsForHyperLogLog().add(keyDailyUV, vuid);
        }

        long todayCount = redis.opsForHyperLogLog().size(keyDailyUV);

        Map<String, Long> result = Map.of(
                "today", todayCount,
                "total", total == null ? 0L : total
        );

        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.SET_COOKIE, "vuid=" + vuid + "; Path=/; Max-Age=31536000; SameSite=Lax");

        return ResponseEntity.ok()
                .headers(headers)
                .cacheControl(CacheControl.noStore())
                .body(result);
    }
}