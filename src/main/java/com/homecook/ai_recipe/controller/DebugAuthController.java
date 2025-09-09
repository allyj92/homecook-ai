// src/main/java/com/homecook/ai_recipe/controller/DebugAuthController.java
package com.homecook.ai_recipe.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.*;

@RestController
@RequestMapping("/api/debug")
public class DebugAuthController {

    @GetMapping("/api/debug/issue-rt")
    public ResponseEntity<String> issueRt(HttpServletResponse res) {
        var rt = ResponseCookie.from("refresh_token", java.util.UUID.randomUUID().toString())
                .httpOnly(true).secure(true).path("/").sameSite("Lax")
                .maxAge(java.time.Duration.ofDays(7)).build();
        res.addHeader(HttpHeaders.SET_COOKIE, rt.toString());
        return ResponseEntity.ok("ok");
    }


    /** A) 쿠키 강제 세팅: 세션 + refresh_token */
    @GetMapping("/set-cookie")
    public ResponseEntity<?> setCookie(HttpServletRequest req) {
        // 세션 생성 → RFSESSIONID 발급(yml 기준)
        req.getSession(true);

        String issued = UUID.randomUUID().toString();
        ResponseCookie refresh = ResponseCookie.from("refresh_token", issued)
                .httpOnly(true).secure(true)
                .path("/")
                .sameSite("Lax")               // yml과 일치
                .maxAge(Duration.ofDays(30))
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refresh.toString())
                .body(Map.of("ok", true, "issued", issued));
    }

    /** B) 현재 요청의 쿠키/인증 상태 확인 */
    @GetMapping("/whoami")
    public Map<String, Object> whoAmI(HttpServletRequest req) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        List<Map<String,String>> cookies = new ArrayList<>();
        if (req.getCookies()!=null) {
            for (Cookie c : req.getCookies()) {
                cookies.add(Map.of("name", c.getName(), "value", c.getValue()));
            }
        }
        return Map.of(
                "cookies", cookies,
                "authenticated", auth != null && auth.isAuthenticated(),
                "principal", auth != null ? auth.getPrincipal() : null
        );
    }
}
