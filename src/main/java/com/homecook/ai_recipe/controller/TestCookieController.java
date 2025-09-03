package com.homecook.ai_recipe.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

// src/main/java/.../TestCookieController.java
@RestController
@RequestMapping("/api/test")
public class TestCookieController {

    @GetMapping("/set-cookie")
    public ResponseEntity<?> setCookie(HttpServletResponse res, HttpServletRequest req, HttpSession session) {
        // 세션 강제 생성(= JSESSIONID 발급 유도)
        session.setAttribute("PING", "PONG");

        // 수동 쿠키 1개 세팅(브라우저가 저장되는지 검사)
        ResponseCookie rc = ResponseCookie.from("demo_cookie", "hello")
                .httpOnly(true)
                .secure(true)            // HTTPS
                .sameSite("None")        // 크로스사이트 허용 (안전하게 그냥 None 사용)
                .path("/")
                .domain("recipfree.com") // 접속 도메인 정확히 일치
                .maxAge(60 * 60)
                .build();

        res.addHeader("Set-Cookie", rc.toString());
        return ResponseEntity.ok(Map.of("ok", true, "secure", req.isSecure()));
    }
}
