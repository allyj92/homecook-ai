package com.homecook.ai_recipe.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class SpaForwardController {

    // ① 1단계 경로: /mypage 같은 단일 세그먼트
    @GetMapping("/{path:^(?!(api|oauth2|login|logout|actuator|error|assets|static|css|js|images|fonts)$).+}")
    public String forwardSingle() {
        return "forward:/index.html";
    }

    // ② 다단계 경로: /mypage/settings 처럼 첫 세그먼트만 필터링하고 나머지는 ** 로 받음 (마지막 요소가 ** 여야 함)
    @GetMapping("/{path:^(?!(api|oauth2|login|logout|actuator|error|assets|static|css|js|images|fonts)$).+}/**")
    public String forwardMulti() {
        return "forward:/index.html";
    }
}