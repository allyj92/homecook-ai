// src/main/java/com/homecook/ai_recipe/service/CustomOidcUserService.java
package com.homecook.ai_recipe.service;

import com.homecook.ai_recipe.auth.UserAccount;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.user.*;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class CustomOidcUserService implements OAuth2UserService<OidcUserRequest, OidcUser> {

    private final OidcUserService delegate = new OidcUserService();
    private final com.homecook.ai_recipe.service.OAuthAccountService oauthService;

    @Override
    public OidcUser loadUser(OidcUserRequest req) throws OAuth2AuthenticationException {
        OidcUser base = delegate.loadUser(req);

        String provider = req.getClientRegistration().getRegistrationId(); // "google"
        String pid = base.getSubject();                                    // sub

        Map<String, Object> claims = new HashMap<>(base.getClaims());
        claims.put("provider", provider);
        claims.put("id", pid); // 공통키(컨트롤러에서 사용)
        String email  = base.getEmail();
        String name   = base.getFullName() != null ? base.getFullName() : (String) claims.get("name");
        String avatar = (String) claims.get("picture");
        boolean verified = Boolean.TRUE.equals(claims.get("email_verified"));

        UserAccount ua = oauthService.findByProvider(provider, pid)
                .orElseGet(() -> {
                    if (email == null || email.isBlank())
                        throw new OAuth2AuthenticationException("unauthenticated_no_email");
                    return oauthService.createUserAndLink(email, name, avatar, provider, pid, verified);
                });

        claims.put("uid", ua.getId());

        final String nameKey = "sub";
        return new DefaultOidcUser(base.getAuthorities(), base.getIdToken(), base.getUserInfo(), nameKey) {
            @Override public Map<String, Object> getClaims() { return claims; }
            @Override public Map<String, Object> getAttributes() { return claims; } // ← 확실히
            @SuppressWarnings("unchecked")
            @Override public <A> A getAttribute(String name) { return (A) claims.get(name); }
        };
    }
}