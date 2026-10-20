package auth_service.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String title;

    @Column(length = 1000)
    private String description;

    private String deadline;

    @Column(name = "estimated_minutes")
    private Integer estimatedMinutes = 30;

    @Column(length = 20)
    private String priority = "MEDIUM"; // HIGH, MEDIUM, LOW

    @Column(length = 20)
    private String status = "PENDING"; // PENDING, COMPLETED, SNOOZED

    @Column(length = 50)
    private String category = "Academic";

    @Column(length = 50)
    private String source = "MANUAL"; // MANUAL, CALENDAR, GOAL, EMAIL, TELEGRAM, AI

    @Column(name = "postponement_count")
    private Integer postponementCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Task() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getDeadline() {
        return deadline;
    }

    public void setDeadline(String deadline) {
        this.deadline = deadline;
    }

    public Integer getEstimatedMinutes() {
        return estimatedMinutes != null ? estimatedMinutes : 30;
    }

    public void setEstimatedMinutes(Integer estimatedMinutes) {
        this.estimatedMinutes = estimatedMinutes;
    }

    public String getPriority() {
        return priority != null ? priority : "MEDIUM";
    }

    public void setPriority(String priority) {
        this.priority = priority;
    }

    public String getStatus() {
        return status != null ? status : "PENDING";
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getCategory() {
        return category != null ? category : "Academic";
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getSource() {
        return source != null ? source : "MANUAL";
    }

    public void setSource(String source) {
        this.source = source;
    }

    public Integer getPostponementCount() {
        return postponementCount != null ? postponementCount : 0;
    }

    public void setPostponementCount(Integer postponementCount) {
        this.postponementCount = postponementCount;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
