package com.untamed.untamedbackend.model;

public enum Role {
    ADVENTURER,
    // Legacy customer role kept temporarily so existing Mongo users keep working until migration.
    USER,
    GUIDE,
    ADMIN
}
