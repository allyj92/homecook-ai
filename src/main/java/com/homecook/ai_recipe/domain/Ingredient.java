package com.homecook.ai_recipe.domain;

import jakarta.persistence.*;
import lombok.*;

@Entity @Getter @Setter @NoArgsConstructor
@Table(uniqueConstraints = @UniqueConstraint(columnNames = "name"))
public class Ingredient {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;
}