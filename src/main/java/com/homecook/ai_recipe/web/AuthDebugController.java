// src/main/java/com/homecook/ai_recipe/web/AuthDebugController.java
package com.homecook.ai_recipe.web;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthDebugController {

    /** 브라우저에 refresh_token + 세션 쿠키 발급 (테스트용) */
    @PostMapping("/bootstrap-cookie")
    public ResponseEntity<Map<String, Object>> bootstrapCookie(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        // 세션 쿠키(RFSESSIONID) 보장
        request.getSession(true);

        // refresh_token 발급 (테스트용 랜덤 값)
        String issued = UUID.randomUUID().toString();
        ResponseCookie refresh = ResponseCookie.from("refresh_token", issued)
                .httpOnly(true)
                .secure(true)
                .path("/")
                .sameSite("Lax")                 // yml 설정과 일치
                .maxAge(Duration.ofDays(30))
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, refresh.toString());
        System.out.println("[AUTH][bootstrap-cookie] issued refresh_token=" + issued.substring(0, 8));

        return ResponseEntity.ok(Map.of(
                "ok", true,
                "refreshShort", issued.substring(0, 8)
        ));
    }

    /** 디버그: 서버가 받은 쿠키 목록 확인 */
    @GetMapping("/debug/echo-cookies")
    public ResponseEntity<Map<String, Object>> echoCookies(HttpServletRequest request) {
        var cookies = request.getCookies();
        var list = new java.util.ArrayList<Map<String, String>>();
        if (cookies != null) {
            for (var c : cookies) {
                list.add(Map.of("name", c.getName(), "valueSample",
                        c.getValue().substring(0, Math.min(8, c.getValue().length()))));
            }
        }
        System.out.println("[AUTH][echo-cookies] " + list);
        return ResponseEntity.ok(Map.of("cookies", list));
    }
}
