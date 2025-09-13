package com.homecook.ai_recipe.dto;

import jakarta.persistence.Column;

public class CommunityPost {
    @Column(name = "rep_image_url", length = 500)
    private String repImageUrl;

    @Column(name = "youtube_id", length = 32)
    private String youtubeId;

    public String getRepImageUrl() { return repImageUrl; }
    public void setRepImageUrl(String repImageUrl) { this.repImageUrl = repImageUrl; }

    public String getYoutubeId() { return youtubeId; }
    public void setYoutubeId(String youtubeId) { this.youtubeId = youtubeId; }
}
