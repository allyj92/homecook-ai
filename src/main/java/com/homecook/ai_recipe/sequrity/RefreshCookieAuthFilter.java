// src/main/java/com/homecook/ai_recipe/security/RefreshCookieAuthFilter.java
package com.homecook.ai_recipe.sequrity;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.*;

public class RefreshCookieAuthFilter extends OncePerRequestFilter {

    private static Cookie findCookie(HttpServletRequest req, String name) {
        Cookie[] cs = req.getCookies();
        if (cs == null) return null;
        for (Cookie c : cs) if (name.equals(c.getName())) return c;
        return null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        // 이미 인증돼 있으면 패스
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            Cookie rf = findCookie(request, "refresh_token");
            if (rf != null && rf.getValue() != null && !rf.getValue().isBlank()) {
                String token = rf.getValue();

                // 데모용: 토큰으로부터 가짜 유저 속성 구성 (실서비스면 서명 검증/DB 조회)
                String idShort = token.length() > 8 ? token.substring(0, 8) : token;
                Map<String, Object> attrs = new LinkedHashMap<>();
                attrs.put("id", "rf:" + idShort);
                attrs.put("name", "SessionUser");
                attrs.put("provider", "refresh");
                attrs.put("email", "rf_" + idShort + "@recipfree.com");
                attrs.put("picture", "https://picsum.photos/seed/rf_" + idShort + "/200/200");

                var roles = List.of(new SimpleGrantedAuthority("ROLE_USER"));
                var principal = new DefaultOAuth2User(new HashSet<>(roles), attrs, "id");
                var auth = new UsernamePasswordAuthenticationToken(principal, null, roles);

                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        chain.doFilter(request, response);
    }
}
