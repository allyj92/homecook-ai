package com.homecook.ai_recipe.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name="user_activity")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserActivity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name="user_id", nullable=false) private Long userId;
    @Column(name="type", nullable=false, length=64) private String type;

    @Column(name="payload_json", nullable=false, columnDefinition="text")
    private String payloadJson; // JSON 문자열 그대로 저장

    @Column(name="ts", nullable=false) private Instant ts;
}