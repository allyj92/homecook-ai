package com.homecook.ai_recipe.controller;


import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaForwardController {

    // 1) 단일 세그먼트 (확장자 없는 경로: /mypage, /activity 등)
    @GetMapping("/{path:[^\\.]+}")
    public String forwardSingle() {
        return "forward:/index.html";
    }

    // 2) 다단계 세그먼트 (확장자 없는 시작 세그먼트 뒤로 뭐가 와도 OK: /community/34, /settings/profile 등)
    @GetMapping("/{path:[^\\.]+}/**")
    public String forwardMulti() {
        return "forward:/index.html";
    }
}