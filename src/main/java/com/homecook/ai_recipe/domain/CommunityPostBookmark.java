package com.homecook.ai_recipe.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity @Table(name="community_post_bookmark")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@IdClass(CommunityPostBookmark.PK.class)
public class CommunityPostBookmark {
    @Id @Column(name="user_id") private Long userId;
    @Id @Column(name="post_id") private Long postId;
    @Column(name="created_at", nullable=false) private Instant createdAt;

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class PK implements java.io.Serializable {
        private Long userId; private Long postId;
    }
}
