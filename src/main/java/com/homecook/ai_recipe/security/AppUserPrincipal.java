// src/main/java/com/homecook/ai_recipe/security/AppUserPrincipal.java
package com.homecook.ai_recipe.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;

public class AppUserPrincipal implements UserDetails {
    private final Long userId;       // **내 DB user PK**
    private final String name;
    private final String email;
    private final String picture;
    private final String provider;
    private final Collection<? extends GrantedAuthority> authorities;

    public AppUserPrincipal(Long userId, String name, String email, String picture, String provider,
                            Collection<? extends GrantedAuthority> authorities) {
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.picture = picture;
        this.provider = provider;
        this.authorities = authorities;
    }

    public Long getUserId() { return userId; }
    public String getDisplayName() { return name; }
    public String getProvider() { return provider; }
    public String getPicture() { return picture; }

    @Override public Collection<? extends GrantedAuthority> getAuthorities() { return authorities; }
    @Override public String getPassword() { return ""; }
    @Override public String getUsername() { return String.valueOf(userId); }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return true; }
}
