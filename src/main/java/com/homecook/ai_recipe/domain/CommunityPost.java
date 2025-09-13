// src/main/java/com/yourapp/community/domain/CommunityPost.java
package com.homecook.ai_recipe.domain;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "community_post")
public class CommunityPost {

    @Column(name = "rep_image_url", length = 500)
    private String repImageUrl;

    @Column(name = "youtube_id", length = 32)
    private String youtubeId;

    public String getRepImageUrl() { return repImageUrl; }
    public void setRepImageUrl(String repImageUrl) { this.repImageUrl = repImageUrl; }
    public String getYoutubeId() { return youtubeId; }
    public void setYoutubeId(String youtubeId) { this.youtubeId = youtubeId; }
// ...

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 40)
    private String category;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @ElementCollection
    @CollectionTable(name = "community_post_tag", joinColumns = @JoinColumn(name = "post_id"))
    @Column(name = "tag", length = 50)
    private List<String> tags = new ArrayList<>();

    // 로그인 붙기 전까지 optional
    @Column(name = "author_id")
    private Long authorId;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    /* --- lifecycle hooks --- */
    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    /* --- getters/setters --- */
    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public Long getAuthorId() { return authorId; }
    public void setAuthorId(Long authorId) { this.authorId = authorId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
