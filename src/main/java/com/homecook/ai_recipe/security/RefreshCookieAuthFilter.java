// src/main/java/com/homecook/ai_recipe/security/RefreshCookieAuthFilter.java
package com.homecook.ai_recipe.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.*;

public class RefreshCookieAuthFilter extends OncePerRequestFilter {

    private final SecurityContextRepository repo;

    public RefreshCookieAuthFilter(SecurityContextRepository repo) {
        this.repo = repo;
    }

    private static boolean startsWithAny(String path, String... prefixes) {
        if (path == null) return false;
        for (String p : prefixes) {
            if (path.startsWith(p)) return true;
        }
        return false;
    }

    private static String getCookie(HttpServletRequest req, String name) {
        Cookie[] cookies = req.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        final String path = req.getRequestURI();
        final String method = req.getMethod();

        // 0) 불필요한 경로는 스킵 (정적/공개/OAuth/헬스체크 등)
        if ("OPTIONS".equalsIgnoreCase(method) ||
                startsWithAny(path,
                        "/css", "/js", "/img", "/static", "/favicon",
                        "/error",
                        "/oauth2", "/login/oauth2",
                        "/api/auth/debug" // 디버그용 엔드포인트에서 인증 강제하지 않음
                )) {
            chain.doFilter(req, res);
            return;
        }

        // 1) 이미 인증돼 있으면 스킵
        Authentication current = SecurityContextHolder.getContext().getAuthentication();
        if (current != null && current.isAuthenticated()) {
            chain.doFilter(req, res);
            return;
        }

        // 2) 쿠키 체크 + 로깅
        Cookie[] rawCookies = req.getCookies();
        if (rawCookies == null || rawCookies.length == 0) {
            System.out.println("[AUTH][RefreshCookieAuthFilter] " + method + " " + path + " : NO cookies");
        } else {
            List<String> names = new ArrayList<>();
            for (Cookie c : rawCookies) names.add(c.getName());
            System.out.println("[AUTH][RefreshCookieAuthFilter] " + method + " " + path + " : cookies=" + names);
        }

        String rt = getCookie(req, "refresh_token");

        if (rt != null && !rt.isBlank()) {
            // 3) refresh_token 쿠키가 있으면 세션 보장 + 컨텍스트 저장
            String shortId = rt.substring(0, Math.min(8, rt.length()));
            var roles = List.of(new SimpleGrantedAuthority("ROLE_USER"));
            Map<String, Object> attrs = Map.of(
                    "id", "rf:" + shortId,
                    "email", "rf_" + shortId + "@recipfree.com",
                    "name", "SessionUser",
                    "provider", "refresh",
                    "picture", "https://picsum.photos/seed/rf_" + shortId + "/200/200"
            );

            var principal = new DefaultOAuth2User(new HashSet<>(roles), attrs, "id");
            var auth = new UsernamePasswordAuthenticationToken(principal, null, roles);

            // 세션은 "필요할 때만" 생성: 여기서는 인증을 세울 것이므로 생성
            req.getSession(true);

            SecurityContext ctx = SecurityContextHolder.createEmptyContext();
            ctx.setAuthentication(auth);
            SecurityContextHolder.setContext(ctx);
            repo.saveContext(ctx, req, res);

            System.out.println("[AUTH][RefreshCookieAuthFilter] authenticated via refresh_token cookie (rf:" + shortId + ")");
        } else {
            System.out.println("[AUTH][RefreshCookieAuthFilter] NO refresh_token cookie -> pass through");
        }

        chain.doFilter(req, res);
    }
}
