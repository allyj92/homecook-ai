package com.homecook.ai_recipe.config;

import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String,String>> handleValidation(MethodArgumentNotValidException ex) {
        var fe = ex.getBindingResult().getFieldError();
        String msg = fe != null ? (fe.getField() + " : " + fe.getDefaultMessage()) : "요청이 유효하지 않습니다.";
        return ResponseEntity.badRequest().body(Map.of("error","ValidationError","message", msg));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String,String>> handleIllegalState(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error","IllegalState","message", ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String,String>> handleEtc(Exception ex) {
        // 메시지가 null이면 기본값
        String msg = ex.getMessage() == null ? "서버 오류" : ex.getMessage();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error","ServerError","message", msg));
    }
}