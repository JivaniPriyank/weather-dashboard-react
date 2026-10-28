from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import AccessRequest, Classroom, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["full_name"]
    list_display = ["full_name", "email", "role", "classroom", "is_active", "date_joined"]
    list_filter = ["role", "classroom", "is_active"]
    search_fields = ["full_name", "email"]
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("full_name", "role", "classroom", "current_level")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "full_name", "role", "password1", "password2")}),)


@admin.register(Classroom)
class ClassroomAdmin(admin.ModelAdmin):
    list_display = ["name", "description", "created_at"]
    search_fields = ["name"]


@admin.register(AccessRequest)
class AccessRequestAdmin(admin.ModelAdmin):
    list_display = ["user", "status", "created_at", "reviewed_at"]
    list_filter = ["status"]
    search_fields = ["user__full_name", "user__email"]
    readonly_fields = ["created_at", "reviewed_at", "reviewed_by"]
