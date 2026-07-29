-- =====================================================================
-- SCRIPT SQL MYSQL - BASE DE DONNÉES SECRÉTAIRE MÉDICALE IA
-- Compatible MySQL 5.7+ / MySQL 8.0+ / MariaDB / phpMyAdmin
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `secretaire_medicale_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `secretaire_medicale_db`;

-- ---------------------------------------------------------------------
-- 1. TABLE : User (Personnel du Cabinet : Médecins, Secrétaires, Admin)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS `MedicalDictation`;
DROP TABLE IF EXISTS `Notification`;
DROP TABLE IF EXISTS `CallLog`;
DROP TABLE IF EXISTS `Appointment`;
DROP TABLE IF EXISTS `DoctorAvailability`;
DROP TABLE IF EXISTS `Faq`;
DROP TABLE IF EXISTS `Patient`;
DROP TABLE IF EXISTS `User`;

CREATE TABLE `User` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `role` VARCHAR(50) NOT NULL COMMENT 'DOCTOR, SECRETARY, ADMIN',
  `specialty` VARCHAR(191) NULL COMMENT 'Optionnel pour les médecins',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. TABLE : Patient (Dossiers Patients)
-- ---------------------------------------------------------------------
CREATE TABLE `Patient` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `firstName` VARCHAR(191) NOT NULL,
  `lastName` VARCHAR(191) NOT NULL,
  `dob` DATETIME NOT NULL,
  `phone` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(191) NULL,
  `insurance` VARCHAR(191) NULL COMMENT 'Carte Vitale, Mutuelle...',
  `treatingPhysician` VARCHAR(191) NULL,
  `consentGdpr` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. TABLE : DoctorAvailability (Disponibilités des Médecins)
-- ---------------------------------------------------------------------
CREATE TABLE `DoctorAvailability` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `doctorId` INT NOT NULL,
  `dayOfWeek` INT NULL COMMENT '0=Dimanche, 1=Lundi, ..., 6=Samedi',
  `startTime` VARCHAR(10) NOT NULL COMMENT 'HH:MM',
  `endTime` VARCHAR(10) NOT NULL COMMENT 'HH:MM',
  `specificDate` DATETIME NULL,
  `isAvailable` TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT `fk_availability_doctor` FOREIGN KEY (`doctorId`) REFERENCES `User` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. TABLE : Appointment (Rendez-Vous Médicaux)
-- ---------------------------------------------------------------------
CREATE TABLE `Appointment` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `patientId` INT NOT NULL,
  `doctorId` INT NOT NULL,
  `startTime` DATETIME NOT NULL,
  `endTime` DATETIME NOT NULL,
  `status` VARCHAR(50) NOT NULL COMMENT 'CONFIRMED, PENDING, CANCELLED, MOVED, URGENT',
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT `fk_appointment_patient` FOREIGN KEY (`patientId`) REFERENCES `Patient` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_appointment_doctor` FOREIGN KEY (`doctorId`) REFERENCES `User` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5. TABLE : CallLog (Historique & Supervision des Appels IA)
-- ---------------------------------------------------------------------
CREATE TABLE `CallLog` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `direction` VARCHAR(20) NOT NULL COMMENT 'INBOUND, OUTBOUND',
  `phoneNumber` VARCHAR(50) NOT NULL,
  `status` VARCHAR(50) NOT NULL COMMENT 'COMPLETED, MISSED, IN_PROGRESS',
  `startTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `endTime` DATETIME NULL,
  `duration` INT NULL COMMENT 'en secondes',
  `transcript` LONGTEXT NULL COMMENT 'Format JSON des tours de parole',
  `summary` TEXT NULL,
  `classification` VARCHAR(100) NULL COMMENT 'EMERGENCY, APPOINTMENT_BOOKING, INFO_REQUEST',
  `language` VARCHAR(50) NOT NULL DEFAULT 'Français',
  `patientId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `fk_calllog_patient` FOREIGN KEY (`patientId`) REFERENCES `Patient` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6. TABLE : Faq (Base de Connaissances IA)
-- ---------------------------------------------------------------------
CREATE TABLE `Faq` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `question` TEXT NOT NULL,
  `answer` TEXT NOT NULL,
  `category` VARCHAR(100) NOT NULL COMMENT 'horaires, adresse, parking, tarifs, preparatifs',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7. TABLE : Notification (SMS / WhatsApp / Email)
-- ---------------------------------------------------------------------
CREATE TABLE `Notification` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `appointmentId` INT NULL,
  `patientId` INT NOT NULL,
  `type` VARCHAR(50) NOT NULL COMMENT 'SMS, WHATSAPP, EMAIL',
  `status` VARCHAR(50) NOT NULL COMMENT 'PENDING, SENT, FAILED',
  `messageContent` TEXT NOT NULL,
  `sentAt` DATETIME NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `fk_notification_appointment` FOREIGN KEY (`appointmentId`) REFERENCES `Appointment` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_notification_patient` FOREIGN KEY (`patientId`) REFERENCES `Patient` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 8. TABLE : MedicalDictation (Dictée Médicale IA & Comptes-Rendus)
-- ---------------------------------------------------------------------
CREATE TABLE `MedicalDictation` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `doctorId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `rawTranscript` LONGTEXT NOT NULL,
  `summary` TEXT NULL,
  `notes` TEXT NULL,
  `exportPdfUrl` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `fk_dictation_doctor` FOREIGN KEY (`doctorId`) REFERENCES `User` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dictation_patient` FOREIGN KEY (`patientId`) REFERENCES `Patient` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- INSERTION DES DONNÉES INITIALES (SEED DE DÉMONSTRATION)
-- =====================================================================

-- Mot de passe haché pour 'password123' : $2a$10$e8wF58xO5Q1sC0O5j5j1zOa8f2z0a
-- 1. Utilisateurs (Personnel du Cabinet)
INSERT INTO `User` (`id`, `email`, `password`, `name`, `role`, `specialty`) VALUES
(1, 'jean.dupont@cabinet.fr', '$2a$10$7R6v/25cKzW2hD.ZgBqV2uJ3/1mP2dE1rF8s9t0u1v2w3x4y5z6a7', 'Dr. Jean Dupont', 'DOCTOR', 'Généraliste'),
(2, 'sophie.lefevre@cabinet.fr', '$2a$10$7R6v/25cKzW2hD.ZgBqV2uJ3/1mP2dE1rF8s9t0u1v2w3x4y5z6a7', 'Dr. Sophie Lefèvre', 'DOCTOR', 'Pédiatrie'),
(3, 'marie.martin@cabinet.fr', '$2a$10$7R6v/25cKzW2hD.ZgBqV2uJ3/1mP2dE1rF8s9t0u1v2w3x4y5z6a7', 'Marie Martin', 'SECRETARY', NULL),
(4, 'admin@cabinet.fr', '$2a$10$7R6v/25cKzW2hD.ZgBqV2uJ3/1mP2dE1rF8s9t0u1v2w3x4y5z6a7', 'Admin Cabinet', 'ADMIN', NULL);

-- 2. Patients de Démo
INSERT INTO `Patient` (`id`, `firstName`, `lastName`, `dob`, `phone`, `email`, `insurance`, `treatingPhysician`, `consentGdpr`) VALUES
(1, 'Alice', 'Dubois', '1990-05-15 00:00:00', '+33612345678', 'alice.dubois@gmail.com', 'Carte Vitale + Mutuelle Aésio', 'Dr. Jean Dupont', 1),
(2, 'Bob', 'Lemoine', '1982-11-23 00:00:00', '+33687654321', 'bob.lemoine@yahoo.fr', 'Carte Vitale', 'Dr. Jean Dupont', 1),
(3, 'Charlie', 'Gerard', '2015-08-04 00:00:00', '+33799887766', 'parent.charlie@outlook.com', 'Carte Vitale', 'Dr. Sophie Lefèvre', 1);

-- 3. Disponibilités des Médecins
INSERT INTO `DoctorAvailability` (`doctorId`, `dayOfWeek`, `startTime`, `endTime`, `isAvailable`) VALUES
(1, 1, '09:00', '12:00', 1),
(1, 1, '14:00', '18:00', 1),
(1, 2, '09:00', '12:00', 1),
(1, 2, '14:00', '18:00', 1),
(1, 3, '09:00', '12:00', 1),
(1, 3, '14:00', '18:00', 1),
(1, 4, '09:00', '12:00', 1),
(1, 4, '14:00', '18:00', 1),
(1, 5, '09:00', '12:00', 1),
(1, 5, '14:00', '18:00', 1),
(2, 2, '08:30', '16:30', 1),
(2, 4, '08:30', '16:30', 1);

-- 4. Base FAQ
INSERT INTO `Faq` (`question`, `answer`, `category`) VALUES
('Quels sont les horaires d\'ouverture du cabinet ?', 'Le cabinet est ouvert du lundi au vendredi de 8h30 à 19h00, et le samedi matin de 9h00 à 12h00.', 'horaires'),
('Quelle est l\'adresse du cabinet ?', 'Nous sommes situés au 14 Rue de la Paix, 75002 Paris, au 2ème étage avec ascenseur.', 'adresse'),
('Y a-t-il un parking à proximité ?', 'Oui, le parking public Indigo "Place de la Concorde" se trouve à 5 minutes à pied du cabinet.', 'parking'),
('Quels sont vos tarifs pour une consultation standard ?', 'La consultation chez nos médecins généralistes est de 25€ (secteur 1, conventionné). Pour la pédiatrie, le tarif est de 30€.', 'tarifs'),
('Quels sont les moyens de paiement acceptés ?', 'Nous acceptons les cartes bancaires, les chèques et les espèces. La carte Vitale est acceptée pour le tiers payant.', 'tarifs');

-- 5. Rendez-Vous
INSERT INTO `Appointment` (`patientId`, `doctorId`, `startTime`, `endTime`, `status`, `notes`) VALUES
(1, 1, NOW() + INTERVAL 1 DAY, NOW() + INTERVAL 1 DAY + INTERVAL 30 MINUTE, 'CONFIRMED', 'Consultation annuelle de contrôle'),
(3, 2, NOW() + INTERVAL 2 DAY, NOW() + INTERVAL 2 DAY + INTERVAL 30 MINUTE, 'PENDING', 'Fièvre persistante, pédiatrie');

-- 6. Historique d'Appels IA (CallLog)
INSERT INTO `CallLog` (`direction`, `phoneNumber`, `status`, `duration`, `classification`, `language`, `patientId`, `transcript`, `summary`) VALUES
('INBOUND', '+33612345678', 'COMPLETED', 145, 'APPOINTMENT_BOOKING', 'Français', 1, 
 '[{"sender":"AI","text":"Bonjour, cabinet médical du Dr Dupont, que puis-je faire pour vous ?"},{"sender":"PATIENT","text":"Bonjour, je voudrais prendre un rendez-vous pour demain."},{"sender":"AI","text":"Très bien, c\'est noté pour demain."}]', 
 'Prise de rendez-vous confirmée pour Alice Dubois.'),
('INBOUND', '+33699999999', 'COMPLETED', 65, 'EMERGENCY', 'Français', NULL, 
 '[{"sender":"AI","text":"Bonjour, cabinet médical."},{"sender":"PATIENT","text":"J\'ai une douleur intense à la poitrine !"},{"sender":"AI","text":"Transfert immédiat au 15 / secrétariat."}]', 
 'Urgence médicale détectée : Douleur thoracique. Transfert effectué.');
