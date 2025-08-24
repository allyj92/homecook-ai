package com.homecook.ai_recipe.dto;

public class FacebookMe {
    public String id;
    public String name;
    public String email;
    public Picture picture;
    public static class Picture { public Data data; }
    public static class Data { public String url; public int width; public int height; }
}