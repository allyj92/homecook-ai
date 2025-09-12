package com.homecook.ai_recipe.domain;

import jakarta.persistence.*;
import lombok.Getter; import lombok.Setter;

@Entity @Table(name="users", indexes = {
        @Index(name="ux_provider_pid", columnList = "provider, providerUserId", unique = true)
})
@Getter @Setter
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String provider;        // "google" | "naver"
    private String providerUserId;  // sub | naver id

    private String email;
    private String name;
    private String picture;
}