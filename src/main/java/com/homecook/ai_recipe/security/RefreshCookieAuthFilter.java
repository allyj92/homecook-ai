// src/main/java/com/homecook/ai_recipe/security/RefreshCookieAuthFilter.java
package com.homecook.ai_recipe.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.*;
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

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        Authentication current = SecurityContextHolder.getContext().getAuthentication();
        if (current == null || !current.isAuthenticated()) {
            String rt = null;
            Cookie[] cookies = req.getCookies();
            if (cookies != null) {
                for (Cookie c : cookies) {
                    if ("refresh_token".equals(c.getName())) { rt = c.getValue(); break; }
                }
            }

            if (rt != null && !rt.isBlank()) {
                String shortId = rt.substring(0, Math.min(8, rt.length()));
                Map<String,Object> attrs = Map.of(
                        "id", "rf:"+shortId,
                        "email", "rf_"+shortId+"@recipfree.com",
                        "name", "SessionUser",
                        "provider", "refresh",
                        "picture", "https://picsum.photos/seed/rf_"+shortId+"/200/200"
                );
                var roles = List.of(new SimpleGrantedAuthority("ROLE_USER"));
                var principal = new DefaultOAuth2User(new HashSet<>(roles), attrs, "id");
                var auth = new UsernamePasswordAuthenticationToken(principal, null, roles);

                req.getSession(true);
                SecurityContext ctx = SecurityContextHolder.createEmptyContext();
                ctx.setAuthentication(auth);
                SecurityContextHolder.setContext(ctx);
                repo.saveContext(ctx, req, res); // ✅ 핵심
            }
        }

        chain.doFilter(req, res);
    }
}
