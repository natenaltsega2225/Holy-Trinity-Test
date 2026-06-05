-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: holy_trinity
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actor_member_id` int DEFAULT NULL,
  `actor_role` varchar(50) DEFAULT NULL,
  `ip` varchar(64) DEFAULT NULL,
  `method` varchar(10) DEFAULT NULL,
  `path` varchar(255) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `target` varchar(100) DEFAULT NULL,
  `status_code` int DEFAULT NULL,
  `request_id` varchar(64) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `details` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `actor_member_id` (`actor_member_id`),
  KEY `action` (`action`),
  KEY `created_at` (`created_at`),
  KEY `idx_audit_logs_created_at` (`created_at`),
  KEY `idx_audit_logs_actor_member_id` (`actor_member_id`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`actor_member_id`) REFERENCES `members` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=71 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,1,'admin','::1','PATCH','/api/admin/users/4/role','ADMIN_MEMBER_ROLE_UPDATE','member:4',200,'1ee9a169-2341-417c-92b2-9fb474f1a5b9','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"4\"}, \"duration_ms\": 7}','2026-02-27 03:50:53'),(2,1,'admin','::1','POST','/api/admin/users','ADMIN_MEMBER_CREATE',NULL,200,'6e0c7da6-bf31-4439-9014-0d99161e0b69','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 62}','2026-02-27 03:52:02'),(3,1,'admin','::1','DELETE','/api/admin/users/4','ADMIN_MEMBER_DELETE','member:4',200,'b95eb374-5fc4-48e0-a6f1-9bf443a833d8','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"4\"}, \"duration_ms\": 20}','2026-02-27 03:53:02'),(4,1,'admin','::1','DELETE','/api/admin/users/3','ADMIN_MEMBER_DELETE','member:3',200,'99bf6581-c8aa-4772-b579-5cb0056ebd2b','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"3\"}, \"duration_ms\": 4}','2026-02-27 03:53:09'),(5,1,'admin','::1','PATCH','/api/admin/users/2/role','ADMIN_MEMBER_ROLE_UPDATE','member:2',200,'1cbfc97a-4f12-4fb5-8e73-6f3ba2dde601','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"2\"}, \"duration_ms\": 5}','2026-02-27 03:54:02'),(6,1,'admin','::1','PATCH','/api/admin/users/6/role','ADMIN_MEMBER_ROLE_UPDATE','member:6',200,'738ed5f4-c1a3-4a9d-bf07-99d84eaf414e','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"6\"}, \"duration_ms\": 2}','2026-02-27 03:59:17'),(7,1,'admin','::1','PATCH','/api/admin/users/6/role','ADMIN_MEMBER_ROLE_UPDATE','member:6',200,'48744312-943e-40c4-8884-d57c12a52d36','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"6\"}, \"duration_ms\": 7}','2026-02-27 04:07:57'),(8,1,'admin','::1','PUT','/api/admin/users/6','ADMIN_MEMBER_UPDATE','member:6',200,'ed7c1987-a849-4b22-8732-be98e4c9769f','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"6\"}, \"duration_ms\": 5}','2026-02-27 04:17:45'),(9,1,'admin','::1','PUT','/api/admin/users/5','ADMIN_MEMBER_UPDATE','member:5',200,'5af66887-689d-4edb-8cdb-f1baf4824fda','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"5\"}, \"duration_ms\": 6}','2026-02-27 04:21:40'),(10,1,'admin','::1','PUT','/api/news-events/8','EVENT_UPDATE',NULL,200,'c683cfb5-be45-4099-adcc-3ae64ab8dd90','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"8\"}, \"duration_ms\": 31}','2026-02-27 20:58:18'),(11,1,'admin','::1','PUT','/api/news-events/8','EVENT_UPDATE',NULL,200,'4932b3e6-84dc-49fc-a158-890921361445','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"8\"}, \"duration_ms\": 12}','2026-02-27 21:00:09'),(12,1,'admin','::1','PUT','/api/news-events/8','EVENT_UPDATE',NULL,200,'15a6c29b-39e0-47d9-b1c6-99cc270ee51f','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"8\"}, \"duration_ms\": 24}','2026-02-27 21:00:49'),(13,1,'admin','::1','PUT','/api/news-events/8','EVENT_UPDATE',NULL,200,'333ad7ef-6563-40e3-bd10-78fbf8eaf623','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"8\"}, \"duration_ms\": 22}','2026-02-27 21:13:56'),(14,1,'admin','::1','PUT','/api/news-events/8','EVENT_UPDATE',NULL,200,'c972cf27-50c2-4772-ac92-9bf941668530','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"8\"}, \"duration_ms\": 20}','2026-02-27 21:54:55'),(15,1,'admin','::1','PUT','/api/admin/users/6','ADMIN_MEMBER_UPDATE','member:6',200,'428fd63d-cfa4-4e7d-864c-ce3705e6d6dc','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"6\"}, \"duration_ms\": 17}','2026-02-27 23:18:28'),(16,1,'admin','::1','PUT','/api/news-events/8','EVENT_UPDATE',NULL,200,'2323649f-2d79-4a06-8dca-f92ee3134229','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"8\"}, \"duration_ms\": 125}','2026-02-28 01:05:44'),(17,1,'admin','::1','PUT','/api/news-events/8','EVENT_UPDATE',NULL,400,'36494e82-504d-4923-9821-7cb46933ccb5','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"8\"}, \"duration_ms\": 11}','2026-02-28 01:06:57'),(18,1,'admin','::1','PUT','/api/news-events/8','EVENT_UPDATE',NULL,400,'534dd439-8e74-48d7-a328-b3f325610cdb','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"8\"}, \"duration_ms\": 4}','2026-02-28 01:06:59'),(19,1,'admin','::1','PUT','/api/news-events/8','EVENT_UPDATE',NULL,400,'aee6adac-1838-4b4a-bd16-0ff160aad1dd','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"8\"}, \"duration_ms\": 17}','2026-02-28 01:07:13'),(20,1,'admin','::1','PUT','/api/news-events/8','EVENT_UPDATE',NULL,200,'7c84b745-e852-4ab0-91b3-988eebd6c4a5','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"8\"}, \"duration_ms\": 30}','2026-02-28 01:07:23'),(21,1,'admin','::1','DELETE','/api/news-events/8','EVENT_DELETE',NULL,200,'851fb8ce-6a75-4e2c-bb2a-76176e4c3fd8','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"8\"}, \"duration_ms\": 11}','2026-02-28 01:07:56'),(22,1,'admin','::1','DELETE','/api/news-events/7','EVENT_DELETE',NULL,200,'1b17181e-aae1-44da-9210-126704aba658','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"7\"}, \"duration_ms\": 13}','2026-02-28 01:08:17'),(23,1,'admin','::1','DELETE','/api/news-events/9','EVENT_DELETE',NULL,200,'3787647f-651d-4f95-a516-8a430557026e','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"9\"}, \"duration_ms\": 10}','2026-02-28 01:08:21'),(24,1,'admin','::1','DELETE','/api/news-events/10','EVENT_DELETE',NULL,200,'2bef59a4-1894-4d48-b693-0a1b384fd0c9','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"10\"}, \"duration_ms\": 11}','2026-02-28 01:08:25'),(25,1,'admin','::1','POST','/api/news-events','EVENT_CREATE',NULL,200,'886fe178-1352-4a5b-b77e-0734bf06e0a0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 103}','2026-02-28 01:11:30'),(26,1,'admin','::1','PUT','/api/news-events/11','EVENT_UPDATE',NULL,200,'89814413-5306-4b0d-9560-793b48f2efc9','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"11\"}, \"duration_ms\": 19}','2026-02-28 01:13:30'),(27,1,'admin','::1','PUT','/api/news-events/11','EVENT_UPDATE',NULL,400,'32753f15-3753-4e9c-adbe-693d1abde8d4','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"11\"}, \"duration_ms\": 108}','2026-02-28 01:57:32'),(28,1,'admin','::1','PUT','/api/news-events/11','EVENT_UPDATE',NULL,400,'948415af-c4bb-4c64-a1e3-c1d2f1edd7b8','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"11\"}, \"duration_ms\": 4}','2026-02-28 01:57:48'),(29,1,'admin','::1','POST','/api/news-events','EVENT_CREATE',NULL,200,'8f44cc63-3361-4056-aafd-bde196bb5d25','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 133}','2026-02-28 02:01:41'),(30,1,'admin','::1','POST','/api/news-events','EVENT_CREATE',NULL,200,'2f65ca9c-f3dd-4975-810b-245ac8f30d1b','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 140}','2026-02-28 16:02:23'),(31,1,'admin','::1','DELETE','/api/news-events/13','EVENT_DELETE',NULL,200,'b9cf27a2-4842-4183-a739-8a1f1d7fbe97','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"13\"}, \"duration_ms\": 22}','2026-02-28 16:04:14'),(32,1,'admin','::1','DELETE','/api/news-events/11','EVENT_DELETE',NULL,200,'0f872166-70a8-4c74-85d4-6ff2e0098aaf','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"11\"}, \"duration_ms\": 15}','2026-02-28 16:04:22'),(33,1,'admin','::1','DELETE','/api/news-events/12','EVENT_DELETE',NULL,200,'cc4e9d7f-7a64-4ccd-9b00-67b14a614c67','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"12\"}, \"duration_ms\": 12}','2026-02-28 16:04:25'),(34,1,'admin','::1','POST','/api/news-events','EVENT_CREATE',NULL,500,'85fe5111-5b75-46ca-bcc4-a41749910c8a','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 59}','2026-02-28 16:06:29'),(35,1,'admin','::1','POST','/api/news-events','EVENT_CREATE',NULL,500,'f8fadee7-e90d-4c78-b11c-c364a8bf83c1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 15}','2026-02-28 16:06:36'),(36,1,'admin','::1','POST','/api/news-events','EVENT_CREATE',NULL,200,'970dbfe0-d6e3-43a2-a8fa-9c365e89b5b0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 23}','2026-02-28 16:07:13'),(37,1,'admin','::1','DELETE','/api/news-events/14','EVENT_DELETE',NULL,200,'c3f21c7c-a798-4051-9885-9576ddcb714c','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"14\"}, \"duration_ms\": 61}','2026-02-28 16:09:21'),(38,1,'admin','::1','POST','/api/news-events','EVENT_CREATE',NULL,200,'943f5df9-23a1-4f01-adc8-f091609b2b51','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 59}','2026-02-28 17:56:34'),(39,1,'admin','::1','POST','/api/news-events','EVENT_CREATE',NULL,200,'b72edc59-0a36-44e8-bb01-1a0ae247f744','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 17}','2026-02-28 18:13:43'),(40,1,'admin','::1','PUT','/api/news-events/15','EVENT_UPDATE',NULL,200,'26efb874-d02a-4ff3-8a25-98f08749eaf6','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"15\"}, \"duration_ms\": 43}','2026-02-28 20:44:52'),(41,1,'admin','::1','PUT','/api/news-events/15','EVENT_UPDATE',NULL,200,'1b0040a2-8140-485c-9171-1eb773f2de47','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"15\"}, \"duration_ms\": 24}','2026-02-28 20:47:09'),(42,1,'admin','::1','POST','/api/news-events/admin','EVENT_CREATE',NULL,200,'71fc00e3-ad10-4be0-8a48-7be4eb9a7428','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 44}','2026-03-02 16:26:33'),(43,1,'admin','::1','POST','/api/news-events/admin','EVENT_CREATE',NULL,200,'d4ad0a29-51e6-4f94-af64-1f1990a0659e','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 35}','2026-03-02 16:49:40'),(44,1,'admin','::1','DELETE','/api/news-events/admin/17','EVENT_DELETE',NULL,200,'704ec8bb-9062-4399-ba15-f8056492e791','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"17\"}, \"duration_ms\": 9}','2026-03-02 16:50:52'),(45,1,'admin','::1','DELETE','/api/news-events/admin/16','EVENT_DELETE',NULL,200,'bc240e8f-fd38-47dc-bbe5-1d3f80827fd7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"16\"}, \"duration_ms\": 8}','2026-03-02 16:50:56'),(46,1,'admin','::1','POST','/api/admin/users','ADMIN_MEMBER_CREATE',NULL,400,'ca418496-14df-4a99-8133-badfb0c180d3','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 7}','2026-03-13 21:27:41'),(47,1,'admin','::1','POST','/api/admin/users','ADMIN_MEMBER_CREATE',NULL,400,'afa31d5b-3236-4ad9-9e71-fd5114988400','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 1}','2026-03-13 21:28:00'),(48,1,'admin','::1','POST','/api/admin/users','ADMIN_MEMBER_CREATE',NULL,400,'541def5c-c9bb-4c22-8bba-980c0a70ee62','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 2}','2026-03-13 22:06:32'),(49,1,'admin','::1','POST','/api/admin/users','ADMIN_MEMBER_CREATE',NULL,400,'d1bad21e-ffd8-45b1-a4a7-de0c9122acda','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 0}','2026-03-13 22:06:49'),(50,1,'admin','::1','POST','/api/admin/users','ADMIN_MEMBER_CREATE',NULL,400,'b0eea8eb-319c-4fe8-bba0-d6add4b8c77d','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 0}','2026-03-13 22:07:01'),(51,1,'admin','::1','POST','/api/admin/users','ADMIN_MEMBER_CREATE',NULL,400,'70c55125-6a4b-4e33-abe7-2687b0e17154','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 4}','2026-03-13 22:07:30'),(52,1,'admin','::1','PATCH','/api/admin/users/5/role','ADMIN_MEMBER_ROLE_UPDATE','member:5',200,'2ad4c55e-8870-4023-a670-c39904734d1a','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"5\"}, \"duration_ms\": 5}','2026-03-13 22:08:59'),(53,1,'admin','::1','POST','/api/admin/users','ADMIN_MEMBER_CREATE',NULL,200,'9a468b26-7b37-46fe-a0d5-a91cff0fc63b','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 41}','2026-03-13 22:11:20'),(54,1,'admin','::1','POST','/api/admin/users','ADMIN_MEMBER_CREATE',NULL,400,'65924786-c3f0-4b4e-872f-059f9f7cbab7','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 1}','2026-03-13 22:11:47'),(55,1,'admin','::1','POST','/api/admin/users','ADMIN_MEMBER_CREATE',NULL,200,'8e34e677-3e8a-49ff-add6-2ffc710df4d3','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 38}','2026-03-13 22:12:09'),(56,1,'admin','::1','DELETE','/api/admin/users/8','ADMIN_MEMBER_DELETE','member:8',200,'06e0744d-50b4-4c35-899a-9ee8c54b22e9','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"8\"}, \"duration_ms\": 72}','2026-03-13 22:26:19'),(57,1,'admin','::1','POST','/api/admin/users','ADMIN_MEMBER_CREATE',NULL,400,'fa0d5a31-78a8-4b77-9d09-972c94cf0556','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 19}','2026-03-13 23:42:28'),(58,1,'admin','::1','POST','/api/news-events/admin','EVENT_CREATE',NULL,200,'eee3e422-0570-47c8-ac46-e424c3ce0dff','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 23}','2026-03-15 20:14:05'),(59,1,'admin','::1','POST','/api/news-events/admin','EVENT_CREATE',NULL,200,'589431aa-fa5c-45d3-8f25-0ac921d65fc8','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 12}','2026-03-15 20:15:18'),(60,1,'admin','::1','POST','/api/news-events/admin','EVENT_CREATE',NULL,200,'dd7123a7-f274-45aa-aad9-644b2cac5118','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 11}','2026-03-15 20:24:26'),(61,1,'admin','::1','POST','/api/news-events/admin','EVENT_CREATE',NULL,200,'b1b3cb89-1264-43bd-b1c3-6ba4591dbadf','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 18}','2026-03-15 20:36:55'),(62,1,'admin','::1','POST','/api/news-events/admin','EVENT_CREATE',NULL,200,'19b6e330-ff55-4ad7-bb8b-c0be3ea6f874','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 21}','2026-03-15 20:46:05'),(63,1,'admin','::1','PATCH','/api/admin/users/5/role','ADMIN_MEMBER_ROLE_UPDATE',NULL,200,'9067d073-b360-426d-b609-38fc0da32536','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {\"id\": \"5\"}, \"duration_ms\": 48}','2026-03-19 22:11:22'),(64,1,'member','::1','POST','/api/members/me/dependents','MEMBER_DEPENDENT_CREATE',NULL,400,'df0ea01d-4cc8-4467-ac49-7fea84cddad0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 8}','2026-03-25 22:28:45'),(65,1,'member','::1','POST','/api/members/me/dependents','MEMBER_DEPENDENT_CREATE',NULL,400,'3fca049e-e6ad-4b94-a7f7-42b525f5ce5f','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 2}','2026-03-25 22:30:36'),(66,1,'member','::1','PUT','/api/members/me','MEMBER_SELF_UPDATE',NULL,500,'81723052-fc92-46dc-9849-d2e7e3bd4c21','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 22}','2026-03-25 22:31:08'),(67,1,'member','::1','PUT','/api/members/me','MEMBER_SELF_UPDATE',NULL,500,'5c199503-65fd-4f7e-9025-6f348244162e','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 30}','2026-03-25 22:31:27'),(68,1,'member','::1','PUT','/api/members/me','MEMBER_SELF_UPDATE',NULL,500,'d6caf501-66e1-4457-9c72-e76e2dfdc2db','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 7}','2026-03-25 22:32:01'),(69,1,'member','::1','POST','/api/members/me/dependents','MEMBER_DEPENDENT_CREATE',NULL,400,'b0e7d821-caac-42aa-8101-3cc71be514c5','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 2}','2026-03-25 23:12:47'),(70,1,'member','::1','PUT','/api/members/me','MEMBER_SELF_UPDATE',NULL,500,'bf5f2166-39ff-4a8c-8f08-7a4fa677b9b0','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','{\"query\": {}, \"params\": {}, \"duration_ms\": 9}','2026-03-25 23:13:07');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `events`
--

DROP TABLE IF EXISTS `events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime DEFAULT NULL,
  `location` varchar(200) DEFAULT NULL,
  `description` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `events`
--

LOCK TABLES `events` WRITE;
/*!40000 ALTER TABLE `events` DISABLE KEYS */;
/*!40000 ALTER TABLE `events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `expenses`
--

DROP TABLE IF EXISTS `expenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `expenses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category` varchar(100) NOT NULL,
  `vendor` varchar(150) DEFAULT NULL,
  `amount_cents` int NOT NULL,
  `currency` char(3) NOT NULL DEFAULT 'usd',
  `method` enum('ach','check','card','cash') NOT NULL,
  `ref_number` varchar(120) DEFAULT NULL,
  `notes` text,
  `paid_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expense_category` (`category`),
  KEY `idx_expense_paid` (`paid_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `expenses`
--

LOCK TABLES `expenses` WRITE;
/*!40000 ALTER TABLE `expenses` DISABLE KEYS */;
/*!40000 ALTER TABLE `expenses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `family_members`
--

DROP TABLE IF EXISTS `family_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `family_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `full_name` varchar(200) NOT NULL,
  `relationship` varchar(50) NOT NULL,
  `birthdate` date DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `member_id` (`member_id`),
  CONSTRAINT `family_members_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `family_members`
--

LOCK TABLES `family_members` WRITE;
/*!40000 ALTER TABLE `family_members` DISABLE KEYS */;
/*!40000 ALTER TABLE `family_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `form_submissions`
--

DROP TABLE IF EXISTS `form_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `form_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `form_key` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `form_name` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `submitted_by` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `baptismal_name` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'new',
  `preferred_date` date DEFAULT NULL,
  `preferred_time` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload_json` json NOT NULL,
  `attachment_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_form_key` (`form_key`),
  KEY `idx_category` (`category`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_submitted_by` (`submitted_by`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `form_submissions`
--

LOCK TABLES `form_submissions` WRITE;
/*!40000 ALTER TABLE `form_submissions` DISABLE KEYS */;
INSERT INTO `form_submissions` VALUES (1,'volunteer','Volunteer Sign-Up','Service','Talon Key',NULL,'raheqimowy@mailinator.com','+1 (989) 527-3799','approved',NULL,NULL,'{\"age\": \"91\", \"email\": \"raheqimowy@mailinator.com\", \"phone\": \"+1 (989) 527-3799\", \"formKey\": \"volunteer\", \"fullName\": \"Talon Key\", \"availability\": \"Occaecat id in qui e\", \"emergencyContact\": \"Facilis quidem offic\", \"skillsExperience\": \"Est tenetur consequa\", \"ministryPreference\": \"Choir\", \"backgroundCheckConsent\": \"true\"}',NULL,'','2026-03-13 11:04:23','2026-03-13 18:33:53'),(5,'prayer','Prayer Request','Spiritual','Zeph Welch','Kim French','fyjygitoqa@mailinator.com','+1 (274) 985-5398','closed',NULL,NULL,'{\"formKey\": \"prayer\", \"message\": \"Ut quo quia aspernat\", \"fullName\": \"Zeph Welch\", \"anonymous\": \"true\", \"personName\": \"Candace Johns\", \"prayerType\": \"Thanksgiving\", \"phoneNumber\": \"+1 (274) 985-5398\", \"baptimalName\": \"Kim French\", \"emailAddress\": \"fyjygitoqa@mailinator.com\"}',NULL,'','2026-03-13 11:12:19','2026-03-13 18:33:58'),(6,'confession','Confession Appointment','Spiritual','Hayley Cervantes','Raven Prince','bipajapo@mailinator.com','+1 (329) 919-2504','in_review','1999-06-26','11:00','{\"email\": \"bipajapo@mailinator.com\", \"notes\": \"Ab adipisicing ut po\", \"phone\": \"+1 (329) 919-2504\", \"formKey\": \"confession\", \"fullName\": \"Hayley Cervantes\", \"churchMember\": \"Yes\", \"baptismalName\": \"Raven Prince\", \"preferredDate\": \"1999-06-26\", \"preferredTime\": \"11:00\", \"guidanceNeeded\": \"Yes\", \"firstConfession\": \"No\", \"priestPreference\": \"Debitis sint consequ\"}',NULL,NULL,'2026-03-13 11:13:15','2026-03-13 11:13:52'),(7,'baptism','Baptism / Christening','Spiritual','Carissa Jensen','Gisela Collier','metifyka@mailinator.com','+1 (299) 659-4782','closed','1991-08-21',NULL,'{\"gender\": \"Female\", \"formKey\": \"baptism\", \"childDob\": \"1995-06-16\", \"baptismName\": \"Gisela Collier\", \"fatherEmail\": \"metifyka@mailinator.com\", \"fatherPhone\": \"+1 (299) 659-4782\", \"motherEmail\": \"gipilycehi@mailinator.com\", \"motherPhone\": \"+1 (293) 633-7393\", \"placeOfBirth\": \"Dolore tempore solu\", \"alternateDate\": \"2018-04-16\", \"childFullName\": \"Carissa Jensen\", \"fatherFullName\": \"Whitney Conway\", \"godparentEmail\": \"segikugos@mailinator.com\", \"godparentPhone\": \"+1 (405) 743-2823\", \"motherFullName\": \"Ahmed Poole\", \"godparentChurch\": \"Quod occaecat hic et\", \"specialRequests\": \"Nobis ullamco porro \", \"godparentFullName\": \"Claudia Kirk\", \"orthodoxChristian\": \"No\", \"additionalComments\": \"Hic qui voluptates m\", \"fatherBaptismalName\": \"Anastasia Kane\", \"motherBaptismalName\": \"Francis Dean\", \"preferredBaptismDate\": \"1991-08-21\", \"fatherMembershipStatus\": \"Non-Member\", \"godparentBaptismalName\": \"Alyssa Bell\", \"motherMembershipStatus\": \"Non-Member\"}',NULL,'','2026-03-13 13:10:54','2026-03-13 13:12:28'),(9,'incident','Incident Report','Misc','Perferendis repudian',NULL,NULL,'Consectetur assumen','new',NULL,NULL,'{\"formKey\": \"incident\", \"signature\": \"Ipsum rerum odit do\", \"witnesses\": \"Deserunt aut beatae \", \"emsContacted\": \"No\", \"incidentType\": \"Property Damage\", \"personInvolved\": \"Perferendis repudian\", \"firstAidProvided\": \"Recusandae Dolores \", \"guardianNotified\": \"No\", \"incidentDateTime\": \"1976-12-12T00:51\", \"incidentLocation\": \"Elit nihil deserunt\", \"contactInformation\": \"Consectetur assumen\", \"ministryLeaderName\": \"Hiram Fitzgerald\", \"detailedDescription\": \"Libero et ea sit fu\", \"followUpActionNeeded\": \"Consequuntur iure fa\"}','/uploads/forms/1773426881319-download.jpg',NULL,'2026-03-13 13:34:41','2026-03-13 13:34:41'),(10,'confession','Confession Appointment','Spiritual','Doris Camacho','Kristen Mathis','hovylowa@mailinator.com','+1 (745) 393-6036','new','2004-02-23','03:18','{\"email\": \"hovylowa@mailinator.com\", \"notes\": \"Laboris facere elige\", \"phone\": \"+1 (745) 393-6036\", \"formKey\": \"confession\", \"fullName\": \"Doris Camacho\", \"churchMember\": \"Yes\", \"baptismalName\": \"Kristen Mathis\", \"preferredDate\": \"2004-02-23\", \"preferredTime\": \"03:18\", \"guidanceNeeded\": \"No\", \"firstConfession\": \"No\", \"priestPreference\": \"Rerum ex eiusmod ass\"}',NULL,'Laboris facere elige','2026-03-13 13:50:37','2026-03-13 13:50:37'),(11,'memorial','Memorial / Funeral Service Request','Spiritual','Allen Hamilton','Marshall Mcdonald','rijivyli@mailinator.com','+1 (176) 752-9042','new','1978-04-28','00:21','{\"formKey\": \"memorial\", \"deceasedDob\": \"2024-05-21\", \"phoneNumber\": \"+1 (176) 752-9042\", \"serviceType\": \"Memorial Prayer\", \"emailAddress\": \"rijivyli@mailinator.com\", \"dateOfPassing\": \"1999-11-09\", \"preferredDate\": \"1978-04-28\", \"preferredTime\": \"00:21\", \"placeOfPassing\": \"Aliquid non voluptas\", \"specialPrayers\": \"Culpa eum perferendi\", \"deceasedFullName\": \"Allen Hamilton\", \"mealArrangements\": \"Ducimus necessitati\", \"memorialDonation\": \"true\", \"contactPersonName\": \"Tatyana Rodgers\", \"deceasedBaptimalName\": \"Marshall Mcdonald\", \"relationshipToDeceased\": \"Possimus deserunt s\"}',NULL,NULL,'2026-03-13 15:45:10','2026-03-13 15:45:10'),(12,'lost','Lost & Found','Incident','Octavius Preston',NULL,NULL,'Sit ad quos aut opti','new',NULL,NULL,'{\"formKey\": \"lost\", \"itemDate\": \"2009-06-09\", \"yourName\": \"Octavius Preston\", \"staffNotes\": \"In expedita sit qui\", \"contactInfo\": \"Sit ad quos aut opti\", \"lostOrFound\": \"Lost\", \"churchLocation\": \"Temporibus nihil lab\", \"pickupLocation\": \"Et nemo sequi conseq\", \"itemDescription\": \"Aliquid nulla deseru\", \"additionalDescription\": \"Reprehenderit occaec\"}','/uploads/forms/1773434888955-image1.png',NULL,'2026-03-13 15:48:08','2026-03-13 15:48:08'),(13,'wedding','Engagement / Wedding Registration','Spiritual','Kylie Mcmahon','Igor Chen','najop@mailinator.com','+1 (858) 711-6962','new','2000-12-31',NULL,'{\"formKey\": \"wedding\", \"brideDob\": \"2013-10-24\", \"groomDob\": \"2015-06-21\", \"brideEmail\": \"jewexukodo@mailinator.com\", \"bridePhone\": \"+1 (436) 448-8049\", \"groomEmail\": \"najop@mailinator.com\", \"groomPhone\": \"+1 (858) 711-6962\", \"guestCount\": \"47\", \"alternateDate\": \"1986-12-01\", \"brideBaptized\": \"Yes\", \"brideFullName\": \"Whitney Owens\", \"brideOrthodox\": \"No\", \"groomBaptized\": \"No\", \"groomFullName\": \"Kylie Mcmahon\", \"groomOrthodox\": \"No\", \"brideConfirmed\": \"No\", \"groomConfirmed\": \"No\", \"specialRequests\": \"Quis blanditiis hic \", \"weddingLocation\": \"Other Location\", \"culturalRequests\": \"Quibusdam proident \", \"brideBaptimalName\": \"Bryar Herring\", \"groomBaptimalName\": \"Igor Chen\", \"scheduleCounseling\": \"Yes\", \"premaritalCounseling\": \"Yes\", \"requestedWeddingDate\": \"2000-12-31\", \"brideMembershipStatus\": \"Non-Member\", \"groomMembershipStatus\": \"Member\"}',NULL,NULL,'2026-03-13 18:23:42','2026-03-13 18:23:42'),(14,'lost','Lost & Found','Incident','Zenia Andrews',NULL,NULL,'Dolorum Nam quo offi','new',NULL,NULL,'{\"formKey\": \"lost\", \"itemDate\": \"1987-06-24\", \"yourName\": \"Zenia Andrews\", \"staffNotes\": \"In dolorum fugiat d\", \"contactInfo\": \"Dolorum Nam quo offi\", \"lostOrFound\": \"Lost\", \"churchLocation\": \"Iure sunt voluptas i\", \"pickupLocation\": \"Eos tenetur fugiat \", \"itemDescription\": \"Dolor modi perspicia\", \"additionalDescription\": \"Laudantium laborios\"}','/uploads/forms/1773444265105-download.jpg',NULL,'2026-03-13 18:24:25','2026-03-13 18:24:25'),(15,'baptism','Baptism / Christening','Spiritual','Fiker','Steven Boyer','gotededy@mailinator.com','+1 (323) 873-1796','new','1998-12-29',NULL,'{\"gender\": \"Male\", \"formKey\": \"baptism\", \"childDob\": \"1985-05-12\", \"baptismName\": \"Steven Boyer\", \"fatherEmail\": \"gotededy@mailinator.com\", \"fatherPhone\": \"+1 (323) 873-1796\", \"motherEmail\": \"mihekyr@mailinator.com\", \"motherPhone\": \"+1 (956) 791-6604\", \"placeOfBirth\": \"Do non expedita ipsu\", \"alternateDate\": \"1986-07-06\", \"childFullName\": \"Fiker\", \"fatherFullName\": \"Aline Ballard\", \"godparentEmail\": \"sujoj@mailinator.com\", \"godparentPhone\": \"+1 (527) 348-9096\", \"motherFullName\": \"Berk Graves\", \"godparentChurch\": \"Dignissimos ab imped\", \"specialRequests\": \"Autem anim fuga Neq\", \"godparentFullName\": \"Dustin Shelton\", \"orthodoxChristian\": \"Yes\", \"additionalComments\": \"Quia eum veniam exp\", \"fatherBaptismalName\": \"Hillary Jacobs\", \"motherBaptismalName\": \"Whilemina Noel\", \"preferredBaptismDate\": \"1998-12-29\", \"fatherMembershipStatus\": \"Non-Member\", \"godparentBaptismalName\": \"Cathleen Barron\", \"motherMembershipStatus\": \"Non-Member\"}',NULL,NULL,'2026-03-14 15:48:10','2026-03-14 15:48:10'),(16,'baptism','Baptism / Christening','Spiritual','Nat kids','Adrienne Wolf','gapux@mailinator.com','+1 (961) 202-9416','new','2003-06-23',NULL,'{\"gender\": \"Male\", \"formKey\": \"baptism\", \"childDob\": \"1989-05-23\", \"baptismName\": \"Adrienne Wolf\", \"fatherEmail\": \"gapux@mailinator.com\", \"fatherPhone\": \"+1 (961) 202-9416\", \"motherEmail\": \"nanuwux@mailinator.com\", \"motherPhone\": \"+1 (877) 464-4475\", \"placeOfBirth\": \"Labore saepe invento\", \"alternateDate\": \"1970-01-19\", \"childFullName\": \"Nat kids\", \"fatherFullName\": \"Hedda Atkins\", \"godparentEmail\": \"mewax@mailinator.com\", \"godparentPhone\": \"+1 (326) 184-3506\", \"motherFullName\": \"Galvin Oneal\", \"godparentChurch\": \"Et est eaque aute ni\", \"specialRequests\": \"Aliquip velit vel qu\", \"godparentFullName\": \"Gloria Shaw\", \"orthodoxChristian\": \"Yes\", \"additionalComments\": \"Molestias voluptate \", \"fatherBaptismalName\": \"Katelyn Conrad\", \"motherBaptismalName\": \"Aurora Harris\", \"preferredBaptismDate\": \"2003-06-23\", \"fatherMembershipStatus\": \"Non-Member\", \"godparentBaptismalName\": \"Haley Chase\", \"motherMembershipStatus\": \"Member\"}',NULL,NULL,'2026-03-15 15:49:59','2026-03-15 15:49:59'),(17,'facility','Facility Use Request','Service','123',NULL,NULL,'nat12@gmail.com','new',NULL,NULL,'{\"name\": \"123\", \"formKey\": \"facility\", \"eventType\": \"4463\", \"contactInfo\": \"nat12@gmail.com\", \"eventDateTime\": \"2026-03-23T14:33\", \"numberOfPeople\": \"-2\", \"audioVisualNeeds\": \"ghgh\", \"cleanupAgreement\": \"true\", \"ministryApproval\": \"\"}',NULL,NULL,'2026-03-23 12:34:02','2026-03-23 12:34:02'),(18,'kids','Kids Program Registration','Programs','12323',NULL,'king12@gmail.com','dggfhdfhh','new',NULL,NULL,'{\"formKey\": \"kids\", \"childDob\": \"2026-03-23\", \"homeAddress\": \"hfghfghfgjfgjhf\", \"parentEmail\": \"king12@gmail.com\", \"parentPhone\": \"dggfhdfhh\", \"childFullName\": \"12323\", \"guardianNames\": \"1354433\", \"paymentMethod\": \"\", \"photoVideoRelease\": \"true\", \"emergencyContactName\": \"king king\", \"emergencyContactPhone\": \"5555555555\", \"permissionToParticipate\": \"true\", \"allergiesMedicalConditions\": \"ghjghj\"}',NULL,NULL,'2026-03-23 12:37:38','2026-03-23 12:37:38');
/*!40000 ALTER TABLE `form_submissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `members`
--

DROP TABLE IF EXISTS `members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(60) NOT NULL,
  `email` varchar(190) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `phone` varchar(40) DEFAULT NULL,
  `address_line1` varchar(200) DEFAULT NULL,
  `address_line2` varchar(200) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(80) DEFAULT NULL,
  `zip` varchar(20) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('member','finance','admin') NOT NULL DEFAULT 'member',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `members`
--

LOCK TABLES `members` WRITE;
/*!40000 ALTER TABLE `members` DISABLE KEYS */;
INSERT INTO `members` VALUES (1,'nigusea@gmail.com','nigusea@gmail.com','Nigusea','Dessie','+15555555555','5652 rice rd',NULL,'Antioch','Tennessee','37013','$argon2id$v=19$m=19456,t=2,p=1$QJx3Uqb8dmYk7dBe4ME5sA$FJn3Wbmsqp0Tcqn8WAy6P+xKFymg13/wAZQLv3ssnSI','admin',1,'2026-02-27 02:41:40','2026-02-27 02:44:56'),(2,'abebe@gmail.com','abebe@gmail.com','Abebe','Belay','+15555555555','5652 rice rd',NULL,'Antioch','Tennessee','37013','$argon2id$v=19$m=19456,t=2,p=1$I2wpQ4tXwtiZ3ZYrX01WWQ$FDFBCUwcj+f4HMQbFBqtsP2sromETf4Iy+tgynI+lUw','finance',1,'2026-02-27 02:42:49','2026-02-27 03:54:02'),(5,'abel2@gmail.com','abel2@gmail.com','Abel','Adem','+197534543221','5652 rice rd',NULL,'Antioch','Tennessee','37013','$argon2id$v=19$m=19456,t=2,p=1$3Vqoo9hCd+L1/pj6tE6sWA$rlF60m6E10kVh0e4m6lSFHKjhbJm7BLQdN8+K9gdj2c','member',1,'2026-02-27 03:36:48','2026-03-19 22:11:22'),(6,'king1234@gmail.com','king1234@gmail.com','king12','king','6152346543','5652 rice rd',NULL,'Antioch','Tennessee','37013','$argon2id$v=19$m=19456,t=2,p=1$wSGb8mS1D9EF6g8iaqD30Q$FMJLYb0n8Qs7C8L2HNH2Epetk16sf2hJ7CdmEvFCSg4','member',1,'2026-02-27 03:52:02','2026-02-27 04:17:45'),(7,'nat12@gmail.com','nat12@gmail.com','nati','Tsega','+15555555555','5652 rice rd',NULL,'Antioch','Tennessee','37013','$argon2id$v=19$m=19456,t=2,p=1$IOpxcmGcZPY44aqzukeoaQ$3BuN3fdnFIiY49X4nGM7I5M2u4fHHGHrJ+mupDa4dOk','member',1,'2026-03-13 22:11:20','2026-03-13 22:11:20');
/*!40000 ALTER TABLE `members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `membership_dues`
--

DROP TABLE IF EXISTS `membership_dues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `membership_dues` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `plan_label` varchar(100) DEFAULT NULL,
  `months_count` int DEFAULT NULL,
  `amount_total_cents` int NOT NULL,
  `stripe_subscription_id` varchar(120) DEFAULT NULL,
  `stripe_checkout_session` varchar(120) DEFAULT NULL,
  `status` enum('created','active','canceled','incomplete','paid','past_due') NOT NULL DEFAULT 'created',
  `period_start` datetime DEFAULT NULL,
  `period_end` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dues_member` (`member_id`),
  KEY `idx_dues_status` (`status`),
  CONSTRAINT `fk_dues_member` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `membership_dues`
--

LOCK TABLES `membership_dues` WRITE;
/*!40000 ALTER TABLE `membership_dues` DISABLE KEYS */;
INSERT INTO `membership_dues` VALUES (1,2,'6 Months (one-time total)',6,15000,NULL,'cs_test_a1fSpC9ECCh8Ft9xPViVuhRdilGEAaQEDoATYrbFQiu9xBPCXuG8Gptpim','created',NULL,NULL,'2026-02-25 05:21:07'),(2,5,'Month-to-Month (1 month)',1,2500,NULL,NULL,'created',NULL,NULL,'2026-03-03 16:06:10');
/*!40000 ALTER TABLE `membership_dues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `news_events`
--

DROP TABLE IF EXISTS `news_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `news_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category` enum('kids','holiday','trip','news') NOT NULL,
  `title` varchar(255) NOT NULL,
  `subtitle` varchar(255) DEFAULT NULL,
  `summary` text,
  `body_html` mediumtext,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `time_text` varchar(120) DEFAULT NULL,
  `time_tex` varchar(120) DEFAULT NULL,
  `event_time` varchar(20) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `flyer_url` varchar(500) DEFAULT NULL,
  `audience` varchar(255) DEFAULT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `pdf_url` varchar(500) DEFAULT NULL,
  `pdf_title` varchar(255) DEFAULT NULL,
  `details` text,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_dates` (`start_date`,`end_date`),
  KEY `idx_pub` (`is_published`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `news_events`
--

LOCK TABLES `news_events` WRITE;
/*!40000 ALTER TABLE `news_events` DISABLE KEYS */;
INSERT INTO `news_events` VALUES (15,'kids','class',NULL,'welcome','<h2><span style=\"color: rgb(22, 29, 38); background-color: rgba(0, 0, 0, 0);\">AWS Global Infrastructure</span></h2><h5><span style=\"color: rgb(35, 43, 55); background-color: rgba(0, 0, 0, 0);\">The AWS Cloud spans 123 Availability Zones within 39 Geographic Regions, with announced plans for 7 more Availability Zones and 2 more AWS Regions in the Kingdom of Saudi Arabia, and Chile.</span></h5>','2026-02-28','2026-02-28',NULL,NULL,NULL,'434 rice rd','/uploads/news-events/1772311492645-download.jpg','all',1,NULL,'2026-02-28 17:56:34','2026-02-28 20:47:09','/uploads/news-events/1772311629124-adacloudtech-ec2-deploy-troubleshoot.pdf',NULL,NULL),(18,'kids','scool',NULL,'join us','Holy Trinity Ethiopian Orthodox Tewahedo Church is a vibrant spiritual community dedicated to preserving our ancient faith while serving our modern world. We welcome all who seek to grow in their relationship with God through the rich traditions of Ethiopian Orthodoxy.','2026-03-03','2026-03-03','12:00 pm - 2:00 pm',NULL,NULL,'543 rice rd','/uploads/news-events/1772470180008-download.jpg','all',1,NULL,'2026-03-02 16:49:40','2026-03-02 16:49:40','/uploads/news-events/1772470180010-adacloudtech-ec2-deploy-troubleshoot.pdf','Open PDF (print / download)',NULL),(19,'news','Ester holyday',NULL,NULL,'<span style=\"color: rgb(59, 76, 106); font-family: Arial, sans-serif; font-size: 19px; text-align: center;\">Holy Trinity Ethiopian Orthodox Tewahedo Church is a vibrant spiritual community dedicated to preserving our ancient faith while serving our modern world. We welcome all who seek to grow in their relationship with God</span>','2026-03-18',NULL,'21:30',NULL,NULL,'5161 rice rd','/uploads/news-events/1773605645445-download.jpg','all',1,NULL,'2026-03-15 20:14:05','2026-03-15 20:14:05',NULL,NULL,NULL),(20,'news','test',NULL,NULL,'<span style=\"color: rgb(59, 76, 106); font-family: Arial, sans-serif; font-size: 19px; text-align: center;\">Holy Trinity Ethiopian Orthodox Tewahedo Church is a vibrant spiritual community dedicated to preserving our ancient faith while serving our modern world. We welcome all who seek to grow in their relationship with God</span>','2026-03-18',NULL,'06:14',NULL,NULL,'5161 rice rd','/uploads/news-events/1773605718479-hamsalomi.png','kids',1,NULL,'2026-03-15 20:15:18','2026-03-15 20:15:18',NULL,NULL,NULL),(21,'news','test',NULL,NULL,'&lt;Route path=\"/news-events/announcements/all\" element={&lt;AllAnnouncementsPage /&gt;} /&gt;','2026-03-16',NULL,'00:10',NULL,NULL,'51541 rice rd','/uploads/news-events/1773606266284-hamsalomi.png','kids',1,NULL,'2026-03-15 20:24:26','2026-03-15 20:24:26',NULL,NULL,NULL),(22,'news','test',NULL,NULL,'testkjdhfgkndfkghda;kghkadsghikdas','2026-03-17',NULL,'00:34',NULL,NULL,'45454 rice rd','/uploads/news-events/1773607015313-download.jpg','all',1,NULL,'2026-03-15 20:36:55','2026-03-15 20:36:55',NULL,NULL,NULL),(23,'trip','Test',NULL,NULL,'<span style=\"color: rgb(59, 76, 106); font-family: Arial, sans-serif; font-size: 19px; text-align: center;\">Holy Trinity Ethiopian Orthodox Tewahedo Church is a vibrant spiritual community dedicated to preserving our ancient faith while serving our modern world. We welcome all who seek to grow in their relationship with God</span>','0012-12-21',NULL,'01:12',NULL,NULL,'4353 rice rd','/uploads/news-events/1773607565954-image3.png','all',1,NULL,'2026-03-15 20:46:05','2026-03-15 20:46:05',NULL,NULL,NULL);
/*!40000 ALTER TABLE `news_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `member_id` int NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `member_id` (`member_id`),
  KEY `idx_refresh_tokens_token_hash` (`token_hash`),
  KEY `idx_refresh_tokens_member_id` (`member_id`),
  CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=668 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `refresh_tokens`
--

LOCK TABLES `refresh_tokens` WRITE;
/*!40000 ALTER TABLE `refresh_tokens` DISABLE KEYS */;
INSERT INTO `refresh_tokens` VALUES (1,1,'eebef087823bf4d332f1d27730dc4da935bc38631c55ecc51b2c360db19d3bc7','2026-03-12 21:41:40','2026-02-26 20:41:54','2026-02-27 02:41:40'),(2,1,'fec79c755c9c31e2ebbad415fcbae8a827a70ac0f846aef68108493630e25e25','2026-03-12 21:41:55',NULL,'2026-02-27 02:41:55'),(3,2,'2116be6d76eec8ff60d0ecd08bb93f7934b86634be3db128f5afd2296a767936','2026-03-12 21:42:49',NULL,'2026-02-27 02:42:49'),(6,1,'08a1836eba4684e2895cdfe9677bb7b2529e4f0ef0cd30b78cde15a920bec71b','2026-03-12 22:15:31','2026-02-26 21:16:25','2026-02-27 03:15:31'),(7,1,'bef8364865189c730975c2484a1bb5293e4268f01da2ec2e6ded13664b1e19d4','2026-03-12 22:16:25','2026-02-26 21:17:30','2026-02-27 03:16:25'),(8,1,'6a5e2f72a98387f931fa0402d4fb15c033f76338ca81839e43e423747c7ebfe3','2026-03-12 22:17:31',NULL,'2026-02-27 03:17:30'),(9,5,'bd2a676550c43907a7af2532634faaafe49141289fafd3dad79ba823f8bce627','2026-03-12 22:36:48',NULL,'2026-02-27 03:36:48'),(10,1,'d3996fa1d9e022be3eac5ff477883ecc8bb883ec97c1d9a5b9c60cb4c4774704','2026-03-12 22:38:46','2026-02-26 21:50:44','2026-02-27 03:38:45'),(11,1,'1907d293eeb9dc5cc581fc940991ec8d89471fa9600e060c3aa92576243d65f5','2026-03-12 22:50:45','2026-02-26 21:50:59','2026-02-27 03:50:44'),(12,1,'4fc7bc35354fe613988c99892052345a3e3bab92ca84807b8d6f320ab1ae6a94','2026-03-12 22:51:00','2026-02-26 21:53:13','2026-02-27 03:50:59'),(13,1,'31e8963365950e05777af268b1e8e81e5c34fb33f24b03f2cd7abe5db2c06c64','2026-03-12 22:53:13','2026-02-26 21:53:46','2026-02-27 03:53:13'),(14,1,'463a3f50368250503b4cb595bedec39afb544873ac88f0874deec7e55c9d897a','2026-03-12 22:53:46','2026-02-26 21:59:22','2026-02-27 03:53:46'),(15,1,'179bb7cc9b93e0ed592f641ea0d23fcf21f91711ca51d7681107e2394995e38b','2026-03-12 22:59:22','2026-02-26 22:07:30','2026-02-27 03:59:22'),(16,1,'4ae154885bda3e5c244036748ca53e4e2a24c0f1550203b64affa95ff956903b','2026-03-12 23:07:30','2026-02-26 22:16:32','2026-02-27 04:07:30'),(17,1,'fa99a083f219287c533662f20e5e4d25c6f078198f0adb85f6bbf005fc9a144d','2026-03-12 23:16:32',NULL,'2026-02-27 04:16:32'),(18,1,'e20fc16d800e25b4c22bc870e22581bbe16ad2334f2d7726a991cee92ea81399','2026-03-12 23:16:55','2026-02-26 22:37:08','2026-02-27 04:16:55'),(19,1,'e686f72b24fcbc2e920380d471a0beb2d43ae7009a3a9e8c0155ee681c00e5f9','2026-03-12 23:37:08',NULL,'2026-02-27 04:37:08'),(20,1,'85242fdeee37913bf6cfea001ae9a6337588e92d7a1c1d85c68ee01dac55f4b1','2026-03-12 23:37:08','2026-02-26 22:57:28','2026-02-27 04:37:08'),(21,1,'ff6950c22a788776781a13868d5197966149d3d853930b45a97501a1915850a5','2026-03-12 23:57:28','2026-02-26 23:17:06','2026-02-27 04:57:28'),(22,1,'6d3102da764d0f591adbff5b0b5c807cd8d124cba4477193777f76a31f8cac09','2026-03-13 00:17:06','2026-02-26 23:37:00','2026-02-27 05:17:06'),(23,1,'37af7899f88e43d3b1d59a365de9afb7c28b7b8bbafa4af71b6ceda1d3d5167a','2026-03-13 00:37:01','2026-02-26 23:55:50','2026-02-27 05:37:00'),(24,1,'b13d1690a4870dd2543e4952f469a004b58574b0e72b6f3423ba7394f4dd08e6','2026-03-13 00:55:50','2026-02-27 00:29:09','2026-02-27 05:55:50'),(25,1,'f1c0c8c8b33f396b819fe57c559253d60fa008873153692d40ab88d7f626c61b','2026-03-13 01:29:10','2026-02-27 00:29:16','2026-02-27 06:29:09'),(26,1,'b555981b7557ccccc5b264d898840c8c7a89d2a6b6104b7bd8323f2912b5f758','2026-03-13 01:29:17',NULL,'2026-02-27 06:29:16'),(27,2,'ea04a744382c804a7feb4a700f9c6cbaf03f85912714c4bbb615b3a8f7039a2c','2026-03-13 01:36:52','2026-02-27 13:05:23','2026-02-27 06:36:52'),(28,2,'e2fe57cbeed731984c13b00189036e03f9aa9afd5f5425dfa4639489a7c8fbf0','2026-03-13 14:05:24',NULL,'2026-02-27 19:05:23'),(29,1,'f4ef95da8a9a43013c5b0b8a699eb10b9c6d6e7b4bff3371a62f863555d2cd0f','2026-03-13 14:05:51','2026-02-27 13:28:20','2026-02-27 19:05:51'),(30,1,'b03790af4511ef93ba6d76d5bbe7974bafcccd3dfef709c70df0ee83b44e7f4d','2026-03-13 14:28:21','2026-02-27 14:57:34','2026-02-27 19:28:20'),(31,1,'fdab974ed227b4dd0e5238e2e9c95c74fbd8e7fb1d59408bc2559c3c0aa932eb','2026-03-13 15:57:35','2026-02-27 14:58:18','2026-02-27 20:57:35'),(32,1,'54985caf858ebbb3899ca50fa90224948c3c665fe8491a8e48f2cd6cbf8ece01','2026-03-13 15:58:18','2026-02-27 15:01:08','2026-02-27 20:58:18'),(33,1,'67b66e661857acdf0faac8259b389b143ce3b3047326e21ee551e109ff467911','2026-03-13 16:01:08','2026-02-27 15:13:56','2026-02-27 21:01:08'),(34,1,'a87bb3101c09a331816c1629cf0b90009a63682fe868d4c9a4f7f53e07a9e113','2026-03-13 16:13:56','2026-02-27 15:54:46','2026-02-27 21:13:56'),(35,1,'690c862ccca3dcd0465843a5cd68f4c0db63d85d75846e7e77ca1204274a8d6b','2026-03-13 16:54:46','2026-02-27 15:54:55','2026-02-27 21:54:46'),(36,1,'ce937e0c0a99fc7d002bd833b620767f2cc70327df0bb653bca84f66b704da84','2026-03-13 16:54:56','2026-02-27 15:54:58','2026-02-27 21:54:55'),(37,1,'f7ed825dec4526d7ae671763204397c5ac4e33167420c84202ad7e4abe1d416a','2026-03-13 16:54:58','2026-02-27 15:55:00','2026-02-27 21:54:58'),(38,1,'15dda3e4ed99bd123006e0261c5f5fb21bcc6e64fe7c3909272487c7029b78f7','2026-03-13 16:55:01','2026-02-27 15:55:03','2026-02-27 21:55:00'),(39,1,'6c7708dd0e23f41b1dcfe30179a3be64c765956eecb29566ea43d3e172593366','2026-03-13 16:55:03','2026-02-27 16:12:54','2026-02-27 21:55:03'),(40,1,'126445c2aeaf14ad8d30d1441af004909c458229053f4d70ad3e33ea588cb045','2026-03-13 17:12:54','2026-02-27 16:12:55','2026-02-27 22:12:54'),(41,1,'cc0e4be5ac4fe8be12eb773ccc288db7e723ee130ee04006da751828d54d1f77','2026-03-13 17:12:55','2026-02-27 16:20:49','2026-02-27 22:12:55'),(42,1,'0329895ef23153f55e07e480d2645b68eefbb341c99f5373ac3027069f7825c1','2026-03-13 17:20:50',NULL,'2026-02-27 22:20:50'),(43,1,'04b5eb8a33383712bca57ef5ed94c671c7200e152bde875393b232e784bdc146','2026-03-13 17:20:50','2026-02-27 17:10:12','2026-02-27 22:20:50'),(44,1,'1859aee1569ede872547b94ec2661d1ea6c2922565cf54fab3d32768e984e4d6','2026-03-13 18:10:12','2026-02-27 17:11:30','2026-02-27 23:10:12'),(45,1,'c929afd514aa0734398bc423f131dbad26a3596b66907e5cfa7f71d26832a483','2026-03-13 18:11:31','2026-02-27 17:11:56','2026-02-27 23:11:30'),(46,1,'affe537744986cb87f5d470100d353534624d4aa8c0c6adc0b306dcf5fdc7b91','2026-03-13 18:11:57',NULL,'2026-02-27 23:11:56'),(47,1,'faca605e461c8b593a9352605c3b85d6ac6c32b31be4a7583b1363ff30abb558','2026-03-13 18:12:20','2026-02-27 17:18:00','2026-02-27 23:12:20'),(48,1,'a819f1a425383be23736bae8fb6fe72bf49211bdc51aac6edafb0b9a6b16dbdf','2026-03-13 18:18:00',NULL,'2026-02-27 23:18:00'),(49,2,'bd78524885f571540b9b2318a368b20e47e10213a18bc60e9d7944e952f50bd0','2026-03-13 18:23:59','2026-02-27 18:16:21','2026-02-27 23:23:58'),(50,2,'792280673f629c8acb06fd62500e85ec9633281938445410bf289c0a01b4111b','2026-03-13 19:16:22','2026-02-27 19:03:09','2026-02-28 00:16:21'),(51,2,'3fe91798cacd1cc4e7efc31d0f7e567b27258d4963a729c1542cce72710c2703','2026-03-13 20:03:10',NULL,'2026-02-28 01:03:09'),(52,1,'b21127f790c26081762b874c7a1a7799ef3ffeeeef6c14ffb0c98bc0fb3c2d36','2026-03-13 20:03:29','2026-02-27 19:04:01','2026-02-28 01:03:28'),(53,1,'c7b941cf9606a31c0e015066b1af7fe8523d37d53f1cb31136a0f51fbb1e95af','2026-03-13 20:04:01','2026-02-27 19:05:51','2026-02-28 01:04:01'),(54,1,'f48401478ab867a938fa1b41b64c6392d2666c55447d30efbd881437618403fa','2026-03-13 20:05:52','2026-02-27 19:07:35','2026-02-28 01:05:51'),(55,1,'c10ab0e040b2786f383fc3b83815d605e5c81fa8346ca95d3eb3bad1f6545b89','2026-03-13 20:07:35','2026-02-27 19:08:02','2026-02-28 01:07:35'),(56,1,'77101cfe2ff5e2aec3a5fcd88cd11a5d20d275c2d6b3c6415d8ea95e3c27be1c','2026-03-13 20:08:02','2026-02-27 19:08:30','2026-02-28 01:08:02'),(57,1,'d9ee2a9a36c5f0265beae25449bb3afb60ae10920b568046bf0bfcc1e2fcac5a','2026-03-13 20:08:30','2026-02-27 19:11:38','2026-02-28 01:08:30'),(58,1,'1bf440888890e03d5d6987037eafef5b8a6bf3024437f1e8fe0daa329c2f8295','2026-03-13 20:11:39','2026-02-27 19:12:18','2026-02-28 01:11:38'),(59,1,'9ac8ccd14f370bfffa87c184fc014800d0b973e4ac3ea52397683bf2c02702e8','2026-03-13 20:12:18','2026-02-27 19:12:25','2026-02-28 01:12:18'),(60,1,'0c96b2fcb24da2c4fec647010987d520c5ce9c35c6797e012eabda3c0f059f3a','2026-03-13 20:12:26','2026-02-27 19:13:40','2026-02-28 01:12:25'),(61,1,'2d07dedf59b55948f27d2ae16835ac72c6f7ea424d2ed47ad42dfa05b40af1c9','2026-03-13 20:13:40','2026-02-27 19:29:12','2026-02-28 01:13:40'),(62,1,'51e9807655409a4d3adfe4b971ff520044c5248a7bf20b0982ac69e303337c86','2026-03-13 20:29:13','2026-02-27 19:48:32','2026-02-28 01:29:12'),(63,1,'f0c8e3f640064851130cc31563d06a17855fb13b9b10cf170957b6c04ac6f2b4','2026-03-13 20:48:33',NULL,'2026-02-28 01:48:32'),(64,1,'681056a7b516c3d17ab40b6db5fd13dcd17b49a4ac114f1e879b59bc0f63d0c9','2026-03-13 20:48:53','2026-02-27 19:49:55','2026-02-28 01:48:52'),(65,1,'7a205a1f526849227a55fff52fcbf61f66873770231bbf9e902fc88735c50feb','2026-03-13 20:49:56','2026-02-27 19:57:57','2026-02-28 01:49:55'),(66,1,'9159651705d638e9386015bb3e130f676bba4b1f59241d25de89569758012c90','2026-03-13 20:57:57','2026-02-27 20:01:50','2026-02-28 01:57:57'),(67,1,'f23bff11f634c75c6d956923e842c4d7e7bdc685ba8d5f4d8e01712f9aa5a4e8','2026-03-13 21:01:50','2026-02-27 21:15:14','2026-02-28 02:01:50'),(68,1,'99b48d3d37c45acd6c6c192046e98ff8b776d519eaa48e6b072eeb25b7b6fc38','2026-03-13 22:15:15','2026-02-28 08:13:22','2026-02-28 03:15:14'),(69,1,'153a36159c106073d84fb5522dd0a3968a36fc0b42e9aa0e4c71d97946f56261','2026-03-14 09:13:23',NULL,'2026-02-28 14:13:22'),(70,1,'7cbefd023b5dec4c4bec1bafcf0ff3a10af01733884ebfa8d1744ab7f729758c','2026-03-14 09:13:46','2026-02-28 10:00:06','2026-02-28 14:13:46'),(71,1,'f0371d7a47083897fbd100eb4f3d725ea7aafc4e3031bf865d91ee93557dd665','2026-03-14 11:00:07','2026-02-28 10:02:23','2026-02-28 16:00:06'),(72,1,'1c244407935535cf5f999ca2924155dce4766508ec543e8285ed4dd389f303a9','2026-03-14 11:02:23','2026-02-28 10:02:47','2026-02-28 16:02:23'),(73,1,'3db2e3e323daa5f066eabb097908b99fbed201c3f1a693a7dd948970a7881780','2026-03-14 11:02:47','2026-02-28 10:03:15','2026-02-28 16:02:47'),(74,1,'f0b20903af8902606d13967c09e62bf4b34e402873b0fc01b9ca45f995553c14','2026-03-14 11:03:16','2026-02-28 10:04:04','2026-02-28 16:03:16'),(75,1,'ff0e9bf0fa23f644975b2ebae989130c8c12b880f4207e656f93efd73c08449e','2026-03-14 11:04:04','2026-02-28 10:07:25','2026-02-28 16:04:04'),(76,1,'249b0e71380d436c50841ed2be761603431c98312fe2d6586b7ac6ce6ca1bcbc','2026-03-14 11:07:26','2026-02-28 11:54:39','2026-02-28 16:07:25'),(77,1,'93738ddae5d5d8e4e26d75213336dfc26dfd4d711c829bfab5a5633832b3e163','2026-03-14 12:54:39','2026-02-28 11:54:40','2026-02-28 17:54:39'),(78,1,'045654a7adebcbbc6fcb0be1f1be6e5805ff937e0cb303471f838f873d16b672','2026-03-14 12:54:40','2026-02-28 11:56:34','2026-02-28 17:54:40'),(79,1,'6515ac7b7a3a942b4e6478f82a88ad83275073f700fa6f470c9a079e9eec93d4','2026-03-14 12:56:35','2026-02-28 11:56:43','2026-02-28 17:56:34'),(80,1,'dd0f8cf8b146c84b2711f7a3d2443af9ca4a359194b4ffa5764392ab75858533','2026-03-14 12:56:43','2026-02-28 12:09:53','2026-02-28 17:56:43'),(81,1,'ac1581eb53212291c3a7e8ec2a101de264a76947a1328e47f4273e70e6cd5c3c','2026-03-14 13:09:54','2026-02-28 12:10:58','2026-02-28 18:09:53'),(82,1,'88a85fadd1962ea12f229938b2c0fa8c73d1ecccb9dcd7b460b575d192505ba7','2026-03-14 13:10:58','2026-02-28 12:12:27','2026-02-28 18:10:58'),(83,1,'7674ba9398994c1f9ff8ae90b5564c658bb9d0fcafed0ff3856a7c8428a22d9b','2026-03-14 13:12:28','2026-02-28 12:12:28','2026-02-28 18:12:27'),(84,1,'448cf6f052482b871772bb28848abb5acc60b68a68caa733ba05991d7722903f','2026-03-14 13:12:28','2026-02-28 12:13:43','2026-02-28 18:12:28'),(85,1,'e6216404017203dac2c4f9be8a9cc0ede7a26e7a19df443f2245134a3028705b','2026-03-14 13:13:43','2026-02-28 12:13:50','2026-02-28 18:13:43'),(86,1,'91f1715c069df3f50d45524f19f869f5c799c2a4328071a4a849d4c05e97253e','2026-03-14 13:13:50','2026-02-28 13:13:55','2026-02-28 18:13:50'),(87,1,'31fe564445ac4e80cf2a8a4e649e4d3bf515021d869ce27cea6c4953ef10ef82','2026-03-14 14:13:55','2026-02-28 13:14:32','2026-02-28 19:13:55'),(88,1,'900f226158a1184f51ce5100286fb38ff57d4eb46a8fcc4b56f936b6965fb010','2026-03-14 14:14:32',NULL,'2026-02-28 19:14:32'),(89,1,'24d4455ce4b3f319fc76eee503dbb0a897a566f258951e0661b0cc32f6b9630c','2026-03-14 14:14:53','2026-02-28 13:16:29','2026-02-28 19:14:53'),(90,1,'2007257628aeef68f46e86a6898389e37fa6bfd46c84c2251b564051bd17fe47','2026-03-14 14:16:30','2026-02-28 13:23:09','2026-02-28 19:16:29'),(91,1,'435d41af3236be35f0f8e6b8636273db649542b2a21e1e7f838cfeacd843214c','2026-03-14 14:23:09','2026-02-28 13:41:13','2026-02-28 19:23:09'),(92,1,'09b791c2eb132b008dda52a750727fad71ef703b897d37521c64190cb77d1cca','2026-03-14 14:41:14','2026-02-28 13:41:13','2026-02-28 19:41:13'),(93,1,'12099932430056960f2d223f0a7a9647a57ad1f5ecf79c2240a93eb3ab571b9f','2026-03-14 14:41:14','2026-02-28 13:43:53','2026-02-28 19:41:13'),(94,1,'bd07353e2220aac359990e13cc4eac6f8e7cf06c6f8e887e9025abba7f4b17bf','2026-03-14 14:43:53','2026-02-28 13:55:11','2026-02-28 19:43:53'),(95,1,'640fbb63a1d61f8db709db29ae50eeeabd0f9cc6f218d10ba915b102fd1e5baa','2026-03-14 14:55:11','2026-02-28 14:06:35','2026-02-28 19:55:11'),(96,1,'a116c9e7aefdf2e6c15cd500bbaefc604ade653b6eac9890028eb3cecd2bea76','2026-03-14 15:06:36','2026-02-28 14:11:13','2026-02-28 20:06:35'),(97,1,'344297c091b2aab102e0708a0f3b8d99d4eb62ff9b62adb4f21b7f496d0d1fb7','2026-03-14 15:11:14','2026-02-28 14:11:16','2026-02-28 20:11:13'),(98,1,'b7a665a950609d223f3a890f111e4d0dc0c170dd74508e59b86b56c429a73bba','2026-03-14 15:11:17','2026-02-28 14:12:06','2026-02-28 20:11:16'),(99,1,'8f71fe79b30362358a499fa90370bb47a3f097c13c99db847c2a0838a9fabacb','2026-03-14 15:12:07','2026-02-28 14:13:20','2026-02-28 20:12:06'),(100,1,'80a343d0d0f8db897a54674d2d1740ec7e64a0a37ae5fc70e5db6954a4556bab','2026-03-14 15:13:21','2026-02-28 14:13:46','2026-02-28 20:13:20'),(101,1,'32ee0303e044c3d13c5b183df3bbedc16b2c3b1fa14d271ccb1138434388f9ea','2026-03-14 15:13:47','2026-02-28 14:28:21','2026-02-28 20:13:46'),(102,1,'cfacf05a46c3a8fbe439f15724aa73cf8fbe9fa7b55ec451c8e75a2aeb8fba26','2026-03-14 15:28:22','2026-02-28 14:30:59','2026-02-28 20:28:21'),(103,1,'828d51c09ef9e1a8b5ca561e45d9b1e670f7516916833b7286ccd4ee8db60f72','2026-03-14 15:30:59',NULL,'2026-02-28 20:30:59'),(104,1,'186608362753c60ab97de60a5dd145b07de27d101e2d719fbfce0fd359460ac7','2026-03-14 15:31:18','2026-02-28 14:31:28','2026-02-28 20:31:18'),(105,1,'000c7a744020505653f9a4a834738925abb91285f5d10b05e3894b5e2149094b','2026-03-14 15:31:28','2026-02-28 14:31:38','2026-02-28 20:31:28'),(106,1,'8753ba8d25465444ef7b3d17bc361f521a7b705e5fb8607300aab54b639c33c5','2026-03-14 15:31:39','2026-02-28 14:43:01','2026-02-28 20:31:38'),(107,1,'90a503dcc022f99ed19e5b4878cc624b9493bbab6ec5e3650dd2cdf75f2d35b7','2026-03-14 15:43:02','2026-02-28 14:45:16','2026-02-28 20:43:01'),(108,1,'af728a135fd9bc8aa6c2f47d4e54b3d22c27a5fd8088aa554c5d16cdbdc93b55','2026-03-14 15:45:17','2026-02-28 14:47:09','2026-02-28 20:45:16'),(109,1,'d36433ed03e2d48484ea2f5070f16fb3db72b80be00acb6bdcb46701d5c066cc','2026-03-14 15:47:09','2026-02-28 14:47:21','2026-02-28 20:47:09'),(110,1,'542ed4a2703fe1612b2b56006e9f661fc5a82b879f3a9eb82ead09c8132ff493','2026-03-14 15:47:21','2026-02-28 15:07:14','2026-02-28 20:47:21'),(111,1,'49ca25199c150b9ff70309977f5274d03cecfcc7c9bb7210e35a11ed5741a250','2026-03-14 16:07:15','2026-02-28 15:07:23','2026-02-28 21:07:14'),(112,1,'d89baf704e23343d3ec28f2b46e2a9c247b1a6494abfb000c74250f602adfbf9','2026-03-14 16:07:23','2026-02-28 15:08:04','2026-02-28 21:07:23'),(113,1,'124c3859f4e574bd1a8d62a86bbb5591e5ced84ed111aa0c99d3bb3a34f51938','2026-03-14 16:08:04',NULL,'2026-02-28 21:08:04'),(114,1,'9244d26fa8250df89e3a64c2dbd06dc9c3d6fa3173540a7e8ccb9ca7b6d9c51d','2026-03-14 16:08:21','2026-02-28 15:08:25','2026-02-28 21:08:20'),(115,1,'eb8a6df0391f7170468e3bf3a4a3b68375f6b6c7e574e832b3fce3f0d44654d6','2026-03-14 16:08:26','2026-02-28 15:08:27','2026-02-28 21:08:25'),(116,1,'e68446aa8adac16d36e93152bcc5d998e7f1f4af105e43b4ef352aadd444ec81','2026-03-14 16:08:27','2026-02-28 15:08:53','2026-02-28 21:08:27'),(117,1,'4116b427d524f1309700235efabe04d7568993b1c4e41f0eff5b6c90b8725543','2026-03-14 16:08:54','2026-02-28 15:13:27','2026-02-28 21:08:53'),(118,1,'ab2734d612be628c0fb9e286114bfbf322c625391c6b6113bf986e403ebc745e','2026-03-14 16:13:27','2026-02-28 16:02:20','2026-02-28 21:13:27'),(119,1,'f45f7720fc0b84376b7b745ed273aef68f1e3b0133553201c9968fd760f1fba9','2026-03-14 17:02:21','2026-02-28 20:26:55','2026-02-28 22:02:20'),(120,1,'d94970f268f33bd4e89c21d6a47add7d633a1a58f1b653cd2d1388807b265f13','2026-03-14 21:26:56','2026-02-28 20:29:35','2026-03-01 02:26:56'),(121,1,'33817df32bc3eff1c8f4b140a1e7b50df090634e9521ed4d7e13dcc9aad63510','2026-03-14 21:29:36','2026-02-28 21:09:05','2026-03-01 02:29:35'),(122,1,'efd849c57aa55eaab7bc871c11381079cebef66daf6fa8de2e99f23cfb25fa7b','2026-03-14 22:09:05','2026-02-28 21:11:27','2026-03-01 03:09:05'),(123,1,'a6ec4950778956f43b2d42c5c42f42225178f62d80e4055e01b8e7e415290ded','2026-03-14 22:11:28','2026-02-28 21:13:23','2026-03-01 03:11:27'),(124,1,'673133186b1103e50aab9dab3ff4582b538f2cce1c4e3683ad59a9e379d093ca','2026-03-14 22:13:24','2026-03-01 17:04:32','2026-03-01 03:13:23'),(125,1,'3f0617291797f7486081e00c89ba6de670e6037662ddf2a8f9051f545add262d','2026-03-15 18:04:32','2026-03-01 17:04:49','2026-03-01 23:04:32'),(126,1,'a9fdec96a3cdf7562444cad071f53a78d3f2aeb588cb194f64d4bc21b0da4ec3','2026-03-15 18:04:50','2026-03-01 17:08:14','2026-03-01 23:04:49'),(127,1,'b1b60be05c73d2a649986d92ac4d871da941806f968b83ef0ca78a9197ecc00d','2026-03-15 18:08:14','2026-03-02 07:54:43','2026-03-01 23:08:14'),(128,1,'1c93e418df78ce78e52441ccec11f7e4b26a63b8c852109fa0e8be5f56260acb','2026-03-16 08:54:44','2026-03-02 08:33:24','2026-03-02 13:54:43'),(129,1,'e12a06c2142b915cba102bf1f65ffd2d4d9a30bc6966f73b9243cd45f1a95776','2026-03-16 09:33:25',NULL,'2026-03-02 14:33:24'),(130,1,'2bd8a9d1a884baf22e46988990e943778cd877ca046d06d5c07966f997444071','2026-03-16 09:34:07','2026-03-02 08:49:34','2026-03-02 14:34:06'),(131,1,'d28be3994febc0d09777fc3381ab6e2402530d71b58c5a5cc06f96944afb9725','2026-03-16 09:49:35','2026-03-02 09:16:29','2026-03-02 14:49:35'),(132,1,'6670765885996c7cf6e8f0595a17338caa4ffb23704d6a06942aca9792b3ed11','2026-03-16 10:16:30','2026-03-02 10:22:40','2026-03-02 15:16:29'),(133,1,'872b4347815faa31b5705889cd645f94da6a75fbf1bb8e843ac2a8eb20a85761','2026-03-16 11:22:41','2026-03-02 10:23:19','2026-03-02 16:22:40'),(134,1,'d5359699256c69e5eb3cd884efeea1bee511bdd91c94c2e251a40459f2474790','2026-03-16 11:23:19','2026-03-02 10:26:33','2026-03-02 16:23:19'),(135,1,'934b37a94976d82d8ae826c55c1e756b0338ac88898bf5e7a38ee15ef5ac28e2','2026-03-16 11:26:34','2026-03-02 10:31:28','2026-03-02 16:26:33'),(136,1,'beeefe9bff3fcdfc872c4257c62b9a92e5f39b60f83fa5c5c3dd9cb98220bbda','2026-03-16 11:31:28','2026-03-02 10:37:08','2026-03-02 16:31:28'),(137,1,'fb164f4e3ac7d222cac8087738c51cea0bd61f9e26ab7d8e36891dad4bdee9b2','2026-03-16 11:37:09','2026-03-02 10:37:10','2026-03-02 16:37:08'),(138,1,'4bc5a07786975f2a91aa016a9e76991954b4c31354d3b9be972ed42f143afe8c','2026-03-16 11:37:10','2026-03-02 10:49:39','2026-03-02 16:37:10'),(139,1,'317544891f3b09f4c0e5a4e07eb9dd34ec66fcaeb5a59562ad18552e57cebb6f','2026-03-16 11:49:40','2026-03-02 10:49:54','2026-03-02 16:49:39'),(140,1,'763467cda201cd40696b644a6697b5a00adcb782c1ec166f1f3200919c24da31','2026-03-16 11:49:54','2026-03-02 10:50:04','2026-03-02 16:49:54'),(141,1,'46ccaccb048bc27564c21c620fd946ef245cf7a831cf3e26e0bf5b929a436673','2026-03-16 11:50:04',NULL,'2026-03-02 16:50:04'),(142,2,'1f3504bff8802d086d4e2d4f4ff82be3aa1c6648151e550230d435b14e4ac096','2026-03-16 11:58:24','2026-03-02 12:17:20','2026-03-02 16:58:23'),(143,2,'a8a8035b07772ef6d83440ba09ace4de2cd36207c4a6e25e3af43c7b57c5fc50','2026-03-16 13:17:20','2026-03-02 12:17:20','2026-03-02 18:17:20'),(144,2,'cb32536121f78f1bac3f3040dcefcd24ce89bb62dd549ac41ef58a49362d2012','2026-03-16 13:17:20','2026-03-02 13:20:39','2026-03-02 18:17:20'),(145,2,'f969466e4b9a1614313fd5df00687b6171377f095a755d9b9e2e0942723073ed','2026-03-16 14:20:39','2026-03-02 13:20:39','2026-03-02 19:20:39'),(146,2,'8b81b697f09a6289518074d80a9c6627cb6a7a5f174aa603829c747f39453b16','2026-03-16 14:20:40','2026-03-02 13:20:52','2026-03-02 19:20:39'),(147,2,'2e757621070b9691fafd0702c5ff7a24873f2862c72a3c8518d61f484c529b28','2026-03-16 14:20:53','2026-03-02 13:54:09','2026-03-02 19:20:52'),(148,2,'63cb20b6f394869cbe39253a521eaf947606bc3e63d4256796e6d68f5a53cf18','2026-03-16 14:54:09','2026-03-02 14:18:50','2026-03-02 19:54:09'),(149,2,'bb5c1baaba967bc18c1378614cc3b92c51edf4a1bf7113f677974ddea54cf0d3','2026-03-16 15:18:51','2026-03-02 14:18:51','2026-03-02 20:18:50'),(150,2,'dad64a081494bb74b0f08e9833fc61ad05eb915fa18ca68b982b11bb009d6092','2026-03-16 15:18:51','2026-03-02 14:19:14','2026-03-02 20:18:51'),(151,2,'38e0d9a56c8b2d55234f08fa394b71caaadd353723784113c2c34e5f6f385975','2026-03-16 15:19:14','2026-03-02 15:26:17','2026-03-02 20:19:14'),(152,2,'41068e30951e6fdd71b83b028b1c43749da188f5b99aaa0b2697fef99da1cb8c','2026-03-16 16:26:18','2026-03-02 15:26:31','2026-03-02 21:26:17'),(153,2,'10559b74438fd60e843ce4f0c496fe3080ffd22f7bebb3b9e345781bed539a9c','2026-03-16 16:26:32','2026-03-02 15:26:34','2026-03-02 21:26:31'),(154,2,'bda80134da78e1d8d5c065b9339727b31832763987cc6769a1b76f26e844fb5b','2026-03-16 16:26:34',NULL,'2026-03-02 21:26:34'),(155,5,'b3a340f445b065e07839ee3362cb1690a448d88db1a54fd7327a81c21d3e28ec','2026-03-16 16:27:50',NULL,'2026-03-02 21:27:49'),(156,5,'ca1d4b854a8d64b3eb774fe50d2381def4502068485fa25ff4085ffdfdaecfab','2026-03-16 16:28:07',NULL,'2026-03-02 21:28:06'),(157,5,'046628ea35722ee8d68c071592cb22a3eee658b4f71e7f2018f13659d28c55d4','2026-03-16 16:31:58','2026-03-02 15:33:36','2026-03-02 21:31:58'),(158,5,'8a994c06c3a9233d302fd95a4f8570c44138a63767de242a427b85cf72e3a090','2026-03-16 16:33:36','2026-03-02 19:58:03','2026-03-02 21:33:36'),(159,5,'231165cbbfdb35f1c058cf2df5fb76204fff46cfcf13605fe9e99408965145b6','2026-03-16 20:58:04','2026-03-02 19:58:39','2026-03-03 01:58:03'),(160,5,'b0e03ed6311be6fed7aaf57972cebf04cca6d62ba550afc431049f26ce2d75e7','2026-03-16 20:58:40','2026-03-03 09:48:46','2026-03-03 01:58:39'),(161,5,'1ae067c39cc7cb851724cb034b9edce315541c3c23c9b4537f59bb200f993f1e','2026-03-17 10:48:46',NULL,'2026-03-03 15:48:46'),(162,1,'31d65c5c8c52b59e9d1cbbe5c3c1c1e8b63338dbeedeb23943a3a300f50232a4','2026-03-17 10:49:05',NULL,'2026-03-03 15:49:04'),(163,2,'69c727dac184de8b1036915f08984a8498c866136f6b77eb00a87ef787588a3f','2026-03-17 10:51:58',NULL,'2026-03-03 15:51:58'),(164,5,'6d690980f3fe06811c191d1593fc1a50c8030d40028133b47d7f6846ff3ecce1','2026-03-17 10:52:48','2026-03-03 10:21:13','2026-03-03 15:52:48'),(165,5,'258d8dbd559b88c53c88e094f3ba9b595d0caca887f962c5b8a71ec2b81c33ae','2026-03-17 11:21:13','2026-03-03 11:35:24','2026-03-03 16:21:13'),(166,5,'b69cceccdff880f3e9283dda8fc0ffbb7fb169b02bc5a8d977957369c2486940','2026-03-17 12:35:24','2026-03-03 12:01:12','2026-03-03 17:35:24'),(167,5,'3776014724abf08167c2e33c4fed41b09f668ebbc72aa68134e507675a3152e7','2026-03-17 13:01:13','2026-03-03 12:57:55','2026-03-03 18:01:12'),(168,5,'74181b3976c60060a60028a945e4e03dfd3d80c108d2eb264328eb87e82a1811','2026-03-17 13:57:55','2026-03-03 13:17:25','2026-03-03 18:57:55'),(169,5,'09ac139e08f7ffd1864909db2041ab951e399519305e7167b80a70097eed7c36','2026-03-17 14:17:25','2026-03-03 13:32:44','2026-03-03 19:17:25'),(170,5,'8d2fac72a2d3104daacd4b092372f708ab02fb00803c9b4455961eb8f425c7f4','2026-03-17 14:32:44','2026-03-03 13:57:51','2026-03-03 19:32:44'),(171,5,'bcff9dbeae9d642877a68c4623496abf9ba5a8f0b8ccf3a817bb30dc16561f4e','2026-03-17 14:57:51','2026-03-03 14:09:10','2026-03-03 19:57:51'),(172,5,'c80b83d5d6b1c664a56c2515450dae892617ae3e0e5f738d3c83e63bc85b6e6f','2026-03-17 15:09:11',NULL,'2026-03-03 20:09:10'),(173,2,'c9603860fbe68601f3d51b3b3a68d854ce0d7bb043f9abc233c7e884162a6b86','2026-03-17 16:25:08',NULL,'2026-03-03 21:25:07'),(174,1,'039fd4d49951d5021a0e272a7ecb1264640556439d6c432caef2d6012337a631','2026-03-17 16:28:51',NULL,'2026-03-03 21:28:51'),(175,2,'2633a396a07973daaf63a01a30952a5c8e325a387ed66681ced9d23290a18a83','2026-03-17 16:31:35',NULL,'2026-03-03 21:31:35'),(176,5,'9901c22cd2f9bab814e30f1007ca181c0b68228a13e8f785aa3c6ce0e38ba6ea','2026-03-17 16:31:58','2026-03-03 15:37:38','2026-03-03 21:31:57'),(177,5,'dbdcfd0d4b130d6ee4ca32ae86c85642e174c053a03365b9b548c8e7435e736d','2026-03-17 16:37:39',NULL,'2026-03-03 21:37:38'),(178,1,'62bee6d7a7903488a79ad00b576fa57ae7c05b4c767b4721f505fa253a3bcb9a','2026-03-17 16:37:54','2026-03-08 16:18:14','2026-03-03 21:37:54'),(179,2,'e0478cc8dc4b97e7f8519a2be37d3d3c7beda5fdcca9befb7971e4cc9c0f16bd','2026-03-22 16:13:11',NULL,'2026-03-08 21:13:11'),(180,1,'384efe9d622b6130b6939376a093e9175bb0be2548e753c946693ae573e9f5c1','2026-03-22 16:18:15',NULL,'2026-03-08 21:18:14'),(181,2,'888086daf2e9378471d93b0b0b326e3a5bc594ad7271c1e5ecfd214becf37181','2026-03-22 16:18:29',NULL,'2026-03-08 21:18:29'),(182,1,'00f4c8dd313e7b63d1eb3f8af11e4a74ba5f308d805f680d4e6199c562fdac5c','2026-03-22 16:18:56','2026-03-08 16:53:07','2026-03-08 21:18:55'),(183,1,'5168c06ed211e27f0e357a04a0ad79dcba446260646a4ddcfe0f80335aa90afd','2026-03-22 16:53:08','2026-03-08 16:53:09','2026-03-08 21:53:07'),(184,1,'734fe6b2bd3f3f38947145c7fd14dbb422667f170c8cb61a3d0e5857d6adb1db','2026-03-22 16:53:09','2026-03-09 16:50:24','2026-03-08 21:53:09'),(185,2,'ae11f3d1584a7ee58af369e5a677da1e5178b7816e0940c803c96c146243343c','2026-03-23 15:58:48',NULL,'2026-03-09 20:58:48'),(186,1,'cca0c94490ca4d3883134361ebdc83eae3852d5b24e283251d9959fe908bac38','2026-03-23 16:50:25',NULL,'2026-03-09 21:50:24'),(187,2,'5786e4a72c609ca7cfbd8731727646a440c7c66dc40af2ff7e5e1b73766f9211','2026-03-23 16:50:46','2026-03-10 09:11:17','2026-03-09 21:50:45'),(188,2,'178bf4b93e9034036cb8eaed9c082b192b301c497031b57e1614db546f20c37e','2026-03-23 16:59:31',NULL,'2026-03-09 21:59:31'),(189,1,'579b50233f5afa7749096bc3318a0718fdce19565aa08b96b8d16e94c70cc7aa','2026-03-23 17:16:44',NULL,'2026-03-09 22:16:43'),(190,2,'ab0ab20bbc864d15f629c166b7a03d5be3113866271195685d76f89c3c428aeb','2026-03-24 08:23:46',NULL,'2026-03-10 13:23:45'),(191,2,'0243815e8a189d8fd8dbc594059fcaa355140660c1a236da47de1f44ea635cd2','2026-03-24 09:11:17',NULL,'2026-03-10 14:11:17'),(192,1,'e306507972c33d98836e0b4d4598f269247f5116c8614062304f6d5813cde94b','2026-03-24 09:11:31','2026-03-10 10:10:23','2026-03-10 14:11:31'),(193,2,'c17664a9c262297408d570922d846b24395fac7fa69bdbbf8e0145b4cb039ae6','2026-03-24 09:14:47',NULL,'2026-03-10 14:14:47'),(194,1,'10929b1d26331efc4745e2d042ec0847320d37572f6b208843458b91c7460efa','2026-03-24 10:09:46',NULL,'2026-03-10 15:09:46'),(195,1,'fb7825c2dacabe43fbeba59699da5eb354ccceb32dadbdfae6d0c65fa0525e0e','2026-03-24 10:10:23','2026-03-10 10:20:41','2026-03-10 15:10:23'),(196,1,'3297257cd5d59977cce546415da418fbb06a1376eb0729b68e1323149f916cce','2026-03-24 10:20:42','2026-03-10 10:22:52','2026-03-10 15:20:41'),(197,1,'2cd4525e8c3fd456c655443bfa90555906a477eb8d2bb86b4f92a760c80dff4a','2026-03-24 10:22:52','2026-03-10 10:38:45','2026-03-10 15:22:52'),(198,1,'c03fa74888033454f9f60e217990c6222d0d404069b953f763721a73e6f074be','2026-03-24 10:23:12',NULL,'2026-03-10 15:23:12'),(199,1,'15aef34bfb5347c1f03b2c4a49cbf4d3a8731c28f3b0e26369c3ac628857f5f0','2026-03-24 10:38:46','2026-03-10 10:42:03','2026-03-10 15:38:45'),(200,1,'9006ac637ced9474b85c752951207a63ccf2c7d09c215dfbc3435a43a636c01d','2026-03-24 10:42:03','2026-03-10 10:43:11','2026-03-10 15:42:03'),(201,1,'798f6073376969630343c980f553215f3827f28595e34d3a84df1818c82aeb14','2026-03-24 10:43:12','2026-03-10 10:43:14','2026-03-10 15:43:11'),(202,1,'ae261f5fe73d3c90aa849b4702d6632b29ca3dd87b80422a2cd19f62e73cd836','2026-03-24 10:43:14','2026-03-10 10:54:11','2026-03-10 15:43:14'),(203,1,'8881b5949876660ff60d64887b888bb6902a7eca3d6c45bc692465d47d9110db','2026-03-24 10:44:23',NULL,'2026-03-10 15:44:23'),(204,1,'7bd6a93b6e942ac8de1fff7723d3bed110f720e3d7585d71b50e8c4f462ced72','2026-03-24 10:54:12','2026-03-10 10:56:43','2026-03-10 15:54:11'),(205,1,'42ad0c17717cb922502de7a16d6dc0cec7a34d33406ba4132dc7a6e7463fde07','2026-03-24 10:56:44','2026-03-10 11:08:23','2026-03-10 15:56:43'),(206,1,'342f9c7834ce737005c729d231d624b845d5baa14685be89a28ff555242f3bc0','2026-03-24 11:08:23','2026-03-10 11:10:32','2026-03-10 16:08:23'),(207,1,'1955c8a31bdf80c04150b753428c8a1f84ad3a4d81c62e4726d7ef8b7d8ce363','2026-03-24 11:10:32','2026-03-10 11:10:35','2026-03-10 16:10:32'),(208,1,'0c58589c4217e123fd3a0a14d7d1fc26438de96e10fe31517fe7fce4c7bf0e15','2026-03-24 11:10:36','2026-03-10 11:13:34','2026-03-10 16:10:35'),(209,1,'bb4379d6dd14e0f925fed65e22f3fa45dbf810a7aec94144510b1f056318750d','2026-03-24 11:13:34','2026-03-10 11:39:49','2026-03-10 16:13:34'),(210,2,'78c84dff3bddd99c1e42d022b4af59fb2c59132db29bf53bebad19d41483d7fc','2026-03-24 11:35:44',NULL,'2026-03-10 16:35:44'),(211,1,'a63be0457e57ba87480319805d0f97e342d51d8c20f0f1ac832b3af1a9feda92','2026-03-24 11:39:50','2026-03-10 11:42:28','2026-03-10 16:39:49'),(212,1,'fcb94d478a01574dddd408f7f2a01379722f4e69d07afe87459109575ed679e5','2026-03-24 11:42:29','2026-03-10 11:42:31','2026-03-10 16:42:28'),(213,1,'0cec90de9a5ca7695dd037ad5d9aff7339cbabec5f1e93780d2652004caeb8e1','2026-03-24 11:42:31','2026-03-10 11:43:06','2026-03-10 16:42:31'),(214,1,'d407a8d889a71937a389c70776d56afef9611f8e4bfa5140a8227a523ab39e9b','2026-03-24 11:43:07','2026-03-10 11:46:47','2026-03-10 16:43:06'),(215,1,'563035c97e3b34dc4a15a97d73be36ef59a4016f75d8817e9cdc3e69c391c226','2026-03-24 11:46:47','2026-03-10 11:52:23','2026-03-10 16:46:47'),(216,5,'d52f62fd84854b87c9375d844bfc0edb3ec75bdc5f5e41eaddff2ee820f8ed0c','2026-03-24 11:47:16',NULL,'2026-03-10 16:47:15'),(217,1,'65b2a31b712bb53a02dfff8780cfc340710f29b7a64a7c174537260c8b1a4d38','2026-03-24 11:52:23','2026-03-10 12:05:03','2026-03-10 16:52:23'),(218,1,'ac44cde2f3db9f91f98f1bf727eb6c40b8218847f21f907f1b9d60afea31f785','2026-03-24 12:05:03','2026-03-10 12:05:40','2026-03-10 17:05:03'),(219,1,'c3330c2d6ab513043376252a93a9db7ca719c6885de2c3e1f6f26941002e3048','2026-03-24 12:05:40','2026-03-10 12:06:29','2026-03-10 17:05:40'),(220,2,'890f899e71472a340a2d21df1c318655b852fb057230fab1c742da3f8fe7ab07','2026-03-24 12:05:55',NULL,'2026-03-10 17:05:55'),(221,1,'6437f2043b9685c8635e76baa433459dd43ef1b1436a8f0e287edef2afdfbfd0','2026-03-24 12:06:30','2026-03-10 12:47:55','2026-03-10 17:06:29'),(222,5,'21255772bdc7b7ef8c2e9bae7d1f6ccd153d79650c1e872873e9a1d379d4c954','2026-03-24 12:06:58',NULL,'2026-03-10 17:06:58'),(223,1,'05abbf1730ce93dddb601c4a99f556846fc9bd1814a80b13a2624e767454487d','2026-03-24 12:47:56','2026-03-10 12:54:18','2026-03-10 17:47:55'),(224,1,'43b8cec54e1753c202a474836e26de5d579bb40c52d0b1240069a329dae8692a','2026-03-24 12:54:19','2026-03-11 08:17:27','2026-03-10 17:54:18'),(225,1,'d064f40d458111ebe13cb0be0d049b6ae94acb233c4b3dc08880d168bb595292','2026-03-24 13:13:55',NULL,'2026-03-10 18:13:55'),(226,2,'1b5df96499d6795a84662bef05bfb4826933b60b0317ce304a79af6398e1ad96','2026-03-24 13:18:52',NULL,'2026-03-10 18:18:51'),(227,1,'23de743d164d8584c616e197de07191510069f2825fa511d25de71b689f4b5bd','2026-03-25 08:17:28','2026-03-11 11:26:05','2026-03-11 13:17:27'),(228,1,'6c50b0cda58260363ccffa4a6715659a948676d5a6bf8b26eb79b45df00bbaa2','2026-03-25 11:26:05','2026-03-11 15:40:37','2026-03-11 16:26:05'),(229,1,'0b7b83104a0ca7b00d472e6361613256955061e35276964de2f07d24a562a41d','2026-03-25 15:40:38','2026-03-11 15:49:26','2026-03-11 20:40:37'),(230,1,'b1906052411acc1516797609fd702c7aac454278eab5aab4aa2e604534a5f678','2026-03-25 15:49:27','2026-03-11 15:49:57','2026-03-11 20:49:26'),(231,1,'4cc2ae04e1b560fd26e99a0b1a72d79409d1d437f7c7463f6dc3d3172c2e5608','2026-03-25 15:49:58','2026-03-11 16:40:51','2026-03-11 20:49:57'),(232,1,'068860424579dde60fd5de773aa20e744345f0603f4a7d63db1a532535378d02','2026-03-25 16:40:51','2026-03-11 16:42:58','2026-03-11 21:40:51'),(233,1,'0d4aebc49320cac09fd35098b130dcf725b840c3a07411a932f5ffef307e35b7','2026-03-25 16:42:59','2026-03-11 16:55:20','2026-03-11 21:42:58'),(234,1,'8a185edcb1b423951c47e94f1eb7b547f3e3543dbbf13a6b9d3135925e5b78bb','2026-03-25 16:55:21','2026-03-11 18:26:25','2026-03-11 21:55:20'),(235,1,'a6dd9d8860518afb11354f3bb384acce7f9b30e4f2aa4e6c33e0dc5da0bdc946','2026-03-25 18:26:26','2026-03-11 18:30:18','2026-03-11 23:26:25'),(236,1,'99d58b7729b2f0d74d4ef75538c2dfcd456314891df88a13d420211c04449fc3','2026-03-25 18:30:19','2026-03-11 20:14:43','2026-03-11 23:30:18'),(237,1,'bdf39ac1e64f7ca624574535d26e7190894481d40cd86ba15a4c99e11a5457da','2026-03-25 20:14:44','2026-03-11 22:14:50','2026-03-12 01:14:43'),(238,1,'0ab6d98b3f76d47e9eeddbf4de5f46d1b796a41388f7dc5f1e10eb595592c5d7','2026-03-25 22:14:50','2026-03-11 22:22:04','2026-03-12 03:14:50'),(239,1,'2f96982508034fbd3b6038c03cfba92a0494fc12e882625fa49c037142aaa539','2026-03-25 22:22:04','2026-03-12 11:51:00','2026-03-12 03:22:04'),(240,1,'dc7fc30ea370b3260cb383f4f415b1979e76a9263fa5d75b1c89055c19599f68','2026-03-26 11:51:01','2026-03-12 12:18:25','2026-03-12 16:51:00'),(241,1,'277aabbf0c9c6100c70c1807016390dd079dca9a077f45f3af0ccc3cd0cad435','2026-03-26 12:18:26','2026-03-12 12:18:28','2026-03-12 17:18:25'),(242,1,'90bf30fb7f92a9a2de71224aadbcfc2e3d54dbe91205aaddc294d0f12b8a5d68','2026-03-26 12:18:28','2026-03-12 12:22:30','2026-03-12 17:18:28'),(243,1,'9d2da3311a507ff78cb4c36f40a5f2d139ca2f18f64a7aa6c2ea445f2ba66390','2026-03-26 12:22:30','2026-03-12 13:31:46','2026-03-12 17:22:30'),(244,1,'1c22fa38e2dc43be0e79030794424002e2e95a180e9739bc0d382791d634d51d','2026-03-26 13:31:46','2026-03-12 13:31:46','2026-03-12 18:31:46'),(245,1,'83622d4483b8dcd160ef972cf97a50c9d2c68cf86097e21effc59b2090ea1780','2026-03-26 13:31:47','2026-03-12 13:33:06','2026-03-12 18:31:46'),(246,1,'e579a87224b2b76ceb94a02b7f7a0311bd360310df429f090d9b9f852b90721d','2026-03-26 13:33:07','2026-03-12 14:42:13','2026-03-12 18:33:06'),(247,1,'7bdd0b044c97e74e31ca5a71780d98f46649fe0cf97e50d03ee5af22998a0536','2026-03-26 14:42:13','2026-03-12 14:42:55','2026-03-12 19:42:13'),(248,1,'66cd158a20d1defebe84ae7a7868af6da75e8ca4fff76d0d739b565409af7cd3','2026-03-26 14:42:56','2026-03-12 14:42:59','2026-03-12 19:42:55'),(249,1,'272c291a5ed05f7c28ca378573b8ac7f150c153bbb92b0ab57daae970107270a','2026-03-26 14:42:59','2026-03-12 14:43:01','2026-03-12 19:42:59'),(250,1,'58652d48df799d04945bc480c08a2433683939ea5d91a92f8a9849735b6709c8','2026-03-26 14:43:01','2026-03-12 15:09:38','2026-03-12 19:43:01'),(251,1,'a56b8e694ccbe12cff64a4e7bfafe025b18e134adafc1657bb07e8ba70601649','2026-03-26 15:09:38','2026-03-12 15:15:12','2026-03-12 20:09:38'),(252,1,'fb7eefc5668bcff029288b5123f68b3f20ffa9c25a9391eb4cf06550f9f9017d','2026-03-26 15:15:12','2026-03-12 16:01:25','2026-03-12 20:15:12'),(253,1,'711fb4bb25f99389766e3e9341c4bb5e62f1f7d1e67474bf125767f49395f14b','2026-03-26 15:55:11',NULL,'2026-03-12 20:55:11'),(254,1,'23e0d49766fee00384ee2443fab81b5f7b1348d9ce884b5ecdd215f8c07cfada','2026-03-26 16:01:25','2026-03-12 16:03:36','2026-03-12 21:01:25'),(255,1,'3631b2a643b29fc080167626252e004852da31bc7f3b8e92f467b298fe73a0d5','2026-03-26 16:03:37','2026-03-12 16:09:32','2026-03-12 21:03:36'),(256,1,'bff8b503cde5f529d073254364cbe215437663cc5e67873ce56bdd1b830d8d6e','2026-03-26 16:08:32',NULL,'2026-03-12 21:08:31'),(257,1,'cc8ef4e59fe6cd393a95bf11d2ea7579004a217fa40b66434cc7827b76111001','2026-03-26 16:09:33','2026-03-12 16:09:34','2026-03-12 21:09:32'),(258,1,'b9507093d7122f414c6da1093b0405b5a5397a28727cc8c66ca803dbf6f7232c','2026-03-26 16:09:35','2026-03-12 16:09:36','2026-03-12 21:09:34'),(259,1,'e1ebd8277fde20e1add0975a034ef9c642213ed9fa5d5489c9b8b42c55fececd','2026-03-26 16:09:37','2026-03-12 16:12:46','2026-03-12 21:09:36'),(260,1,'6a8dda8dbd2948a824444198aa98128bb7a356a534b480941bf34544478f7fd1','2026-03-26 16:12:46','2026-03-12 16:13:58','2026-03-12 21:12:46'),(261,1,'b501fa936008f53d64c9db2383355cdb1ec87906f6675b985f8b41632cb274f1','2026-03-26 16:13:24',NULL,'2026-03-12 21:13:24'),(262,1,'9b847f98d747b21e2b48968c042ffbeae0809824fab4774edbc6a9112aaed6bf','2026-03-26 16:13:58','2026-03-12 16:19:50','2026-03-12 21:13:58'),(263,1,'04cfb291e765085f6172d811b928a8c50f3a9ee027417d51c177477b064b1a3c','2026-03-26 16:19:50','2026-03-12 16:25:54','2026-03-12 21:19:50'),(264,1,'ef55de28ddbd642e57ced90f0878754b81120660081ff2b76af2de1c56c7baa8','2026-03-26 16:25:55','2026-03-12 16:26:07','2026-03-12 21:25:54'),(265,1,'8faff59e109bb7f7059669e196844a1e9d1c0b0f776f071b6e821476b91497ef','2026-03-26 16:26:08','2026-03-12 16:29:12','2026-03-12 21:26:07'),(266,1,'ceafe99ff40bd8b2167f8fe3c90e9140441dcabe5375a0cfaefb5f9dc53dfc9d','2026-03-26 16:29:12','2026-03-12 16:29:55','2026-03-12 21:29:12'),(267,1,'74b2dbf18c280743d122bddc6e059a7ab7fb0568cabf9466756902ad593aa257','2026-03-26 16:29:55','2026-03-12 16:29:59','2026-03-12 21:29:55'),(268,1,'4e6667047d340b7cbe4aa6d2a2e147deec57945736236a464bb6ceb0dbdf4fc3','2026-03-26 16:29:59','2026-03-12 16:30:43','2026-03-12 21:29:59'),(269,1,'57ed3adfb5cfe75c65e41efbfe5a59994aa7bbf16cd02072f74edf343528a0cc','2026-03-26 16:30:44','2026-03-12 16:31:19','2026-03-12 21:30:43'),(270,1,'12fb0ba3406a30edbaf5a0267c2bf5501f1c99d486d6d34bd4f1a69f76e8a43e','2026-03-26 16:31:20','2026-03-12 16:31:39','2026-03-12 21:31:19'),(271,1,'2516bfcd9a445b25ad39e8dddf00665894875c4242ee94882693354455ccef8a','2026-03-26 16:31:39','2026-03-12 16:31:58','2026-03-12 21:31:39'),(272,1,'fd96bf816c79041f716c8eaf86d39c715bcc24a236c47d124d34a70ce9b28f96','2026-03-26 16:31:58','2026-03-12 16:33:01','2026-03-12 21:31:58'),(273,1,'326f354e9257ff00588990bae54a0335be006e477893070a35acc41b45a25689','2026-03-26 16:33:02','2026-03-12 16:34:31','2026-03-12 21:33:01'),(274,1,'40bf1642dde665dcc0f9534e3891b379da79a89ad1fe0d7eadaba150ae331d6c','2026-03-26 16:34:32','2026-03-12 16:53:16','2026-03-12 21:34:31'),(275,1,'5de985998c9aa91339fd4c0dd39749efe28ff7d42053a691753ec1266ecedf63','2026-03-26 16:53:17','2026-03-12 16:56:16','2026-03-12 21:53:16'),(276,1,'327ab58e1eaf72a3c9541a66d4573207bdff274510254057d429f829d804f352','2026-03-26 16:56:16','2026-03-12 17:09:46','2026-03-12 21:56:16'),(277,1,'59526802465c9b5a3145e851681ea720b28efd382da37def38c3306477c15595','2026-03-26 17:09:46','2026-03-12 17:15:13','2026-03-12 22:09:46'),(278,1,'1dc8b2d7fcfa889b00001d14ed542def98ae1b7d342b966346819f024da75c56','2026-03-26 17:15:13','2026-03-12 17:24:47','2026-03-12 22:15:13'),(279,1,'07a47a2d4bcca446aa9269f7f72d145a13c9aaf903018d18ba1977da16bde957','2026-03-26 17:24:47','2026-03-12 17:36:44','2026-03-12 22:24:47'),(280,1,'e596a5e4de76ab089709157b1656d286a40d6136686a3e9bef545f74cd6caf02','2026-03-26 17:36:45','2026-03-12 17:37:07','2026-03-12 22:36:44'),(281,1,'93ef3d8cc37bbc19ab620e641b0f6cdfa1f8da1d24610c35e7b18960a2d0fa2a','2026-03-26 17:37:08','2026-03-12 17:58:07','2026-03-12 22:37:07'),(282,1,'c6c61d093e5cf2def49475227769033325e58345aaacdd45429421ec959f7ed6','2026-03-26 17:58:07','2026-03-12 17:59:05','2026-03-12 22:58:07'),(283,1,'5363108786becab78cc7fec67471a2d5a7fe4164e33fe0f1d24cf73a7909fa4a','2026-03-26 17:59:05','2026-03-12 18:11:30','2026-03-12 22:59:05'),(284,1,'567da7437ef84341509f668e4e20a573ad04093914bafc1bc576f447d7291bc3','2026-03-26 18:11:30','2026-03-12 18:12:40','2026-03-12 23:11:30'),(285,1,'f3e522ca57fb236a2799e3e87a2525947afdb261199f96dac7a885d87855cc4d','2026-03-26 18:12:40','2026-03-12 18:27:00','2026-03-12 23:12:40'),(286,1,'feb00bf7b83745c9dff424d58292c5e74851e01d19fae782b603161383cf0537','2026-03-26 18:27:00','2026-03-12 18:28:51','2026-03-12 23:27:00'),(287,1,'dc5ef8c5c1bb8971ec7be5421409254da6dde19f25c38f216419fc9e40f9e8be','2026-03-26 18:28:52','2026-03-12 18:43:13','2026-03-12 23:28:51'),(288,1,'807809f0cb40f75798030c53801d3a784253d258a0d8c2310186437b8cbd9fa8','2026-03-26 18:43:14','2026-03-12 18:52:52','2026-03-12 23:43:13'),(289,1,'0be8e1ca12ce764e1d3c2039baac88e3f77a301d54c4c8206a5c32f66b82fc31','2026-03-26 18:52:52','2026-03-12 18:57:10','2026-03-12 23:52:52'),(290,1,'267950558318e88f95775a29d8a55c2b962fae9bd57a51c811045707e40a559c','2026-03-26 18:57:10','2026-03-12 19:03:03','2026-03-12 23:57:10'),(291,1,'d039c6e966374ae11275e4c975758247c17bb3aba616dc6daf2f161f2765af4a','2026-03-26 19:03:04','2026-03-12 19:03:03','2026-03-13 00:03:03'),(292,1,'c3625b360d2f513aeb62bd639ef31103b4750fe9a6970d5d7ede993634c7c7b6','2026-03-26 19:03:04','2026-03-12 19:07:53','2026-03-13 00:03:03'),(293,1,'5313fefd42649b23ed1dfa06500bb62315d496f1f03e81fcd2f7a1f59766cc80','2026-03-26 19:07:54','2026-03-12 19:08:12','2026-03-13 00:07:53'),(294,1,'b33fd66ff89f080744c45bccad19139d5381fe3a0393ef4e0bb5185d8afce520','2026-03-26 19:08:12','2026-03-12 19:17:36','2026-03-13 00:08:12'),(295,1,'fde955af0d299edfe395ee8a5dc790f6e70909c9597d19c1e275e7c7e47efe50','2026-03-26 19:17:36','2026-03-12 19:55:15','2026-03-13 00:17:36'),(296,1,'87e60e2ce71f473433bdc90d4b336920cce0a84712e0cf212094bad79cdfae15','2026-03-26 19:55:16','2026-03-12 19:55:20','2026-03-13 00:55:15'),(297,1,'05f21de2d2b7c4b64c181adfb886f5b051e7967de6b6c747b3064ba59db79753','2026-03-26 19:55:20','2026-03-12 19:55:22','2026-03-13 00:55:20'),(298,1,'1845be511986e602fd17fc800d9d0b44ae149fa602631fbbf87e78b8a46ff3a8','2026-03-26 19:55:23','2026-03-12 19:55:30','2026-03-13 00:55:22'),(299,1,'2892a20556b7283abff498389e2248da44910eaae2bfb2619465782fd73aeeed','2026-03-26 19:55:30','2026-03-12 19:55:40','2026-03-13 00:55:30'),(300,1,'1f3b9cfe2db51cec65dce663e7417918426522763cf47346d1e8af1036e2d244','2026-03-26 19:55:41','2026-03-12 19:56:32','2026-03-13 00:55:40'),(301,1,'cee837236c06069a4a88403f8fef24233f9b63b46c6d2a867fff1e453df1030a','2026-03-26 19:56:33','2026-03-13 07:50:49','2026-03-13 00:56:32'),(302,1,'1a9e32f26b0cb1bb940f8ba671c79de4d14289b69a9476e0b83091ac2e90299f','2026-03-27 07:50:50','2026-03-13 09:09:18','2026-03-13 12:50:49'),(303,1,'539aa64136f3a3ebdba7e1b1544a8f19ae3fc70e867c26fc421b8d6d3c478e36','2026-03-27 09:08:00',NULL,'2026-03-13 14:07:59'),(304,1,'e0a7640a71d419d8d26846ee0ea707944e2c359c0800e4d02ecfd10b46742a17','2026-03-27 09:09:19','2026-03-13 09:09:34','2026-03-13 14:09:18'),(305,1,'d2cd64c848969a3fd460ff0f344a5417d8e2e5ec33646c22a11ca544b1937a02','2026-03-27 09:09:34','2026-03-13 09:12:08','2026-03-13 14:09:34'),(306,1,'bb1d1b103f143f2de418227c6970fc67c5b7e034a8b642af750036f57f8ef80c','2026-03-27 09:12:08','2026-03-13 09:12:16','2026-03-13 14:12:08'),(307,1,'f894586b0feb06cc5b6d678a4911ca112764892cdb25052e446de15fea68830a','2026-03-27 09:12:16','2026-03-13 10:41:38','2026-03-13 14:12:16'),(308,1,'1c74c0c7ccc7bdeace132469129ec1fcd8107bcc9f0f7d62a6a8b86575862c32','2026-03-27 10:41:39','2026-03-13 10:41:52','2026-03-13 15:41:38'),(309,1,'f2698b9920fab2c9b5085ea3ee397ae89d2d8a8a8d0e392faf595713a5dbb4df','2026-03-27 10:41:53','2026-03-13 10:42:38','2026-03-13 15:41:52'),(310,1,'eeaa91773fbdad590b7b3a04095968ae90110c66cde778cbf026bd889d573d8a','2026-03-27 10:42:38','2026-03-13 10:42:40','2026-03-13 15:42:38'),(311,1,'00300f50296e5712e0173e70000a7ffeaf65fc8a841eb2947bcb476be18496d6','2026-03-27 10:42:41','2026-03-13 11:04:10','2026-03-13 15:42:40'),(312,1,'a564d4d954241850caf5c1875affd8dcb524c73d815535438d2a63083bf21961','2026-03-27 10:42:54',NULL,'2026-03-13 15:42:54'),(313,1,'5d87b435bc19f2b00a3f12d850f6e0344111508b0f604918f1de0c7dbd0ee0d8','2026-03-27 11:04:10','2026-03-13 11:06:01','2026-03-13 16:04:10'),(314,1,'3a90bd39963ec26fb8a034ea4cddaf7ee1a7c3429be403f5e625d64d4f05514b','2026-03-27 11:06:02','2026-03-13 11:06:16','2026-03-13 16:06:01'),(315,1,'8c1b765fe038f3cfec65873b579bd8f0631c39a8d1bca942391f9b1cb32b5eea','2026-03-27 11:06:17','2026-03-13 11:06:16','2026-03-13 16:06:16'),(316,1,'5563d36bbedddf1b413c7c70bdd824262879cd400f4b8f484a345af4ddb6deb3','2026-03-27 11:06:17','2026-03-13 11:06:18','2026-03-13 16:06:16'),(317,1,'4a5c2d6a4804d774a02afbb2542f08cd1af78f0907c7b6f8c048a75077bdd8f7','2026-03-27 11:06:18','2026-03-13 11:07:36','2026-03-13 16:06:18'),(318,1,'6769fc6e9cea3b02a1bf0d5e47b7dbaa7e897cba1d424ed40a087760fd17c243','2026-03-27 11:07:37','2026-03-13 11:12:27','2026-03-13 16:07:36'),(319,1,'0bc549fcbda8580f5b34e8a2465eded55a2f1eded2f9ca42687732a25f3dd8b8','2026-03-27 11:12:28','2026-03-13 11:13:24','2026-03-13 16:12:27'),(320,1,'217d4be305b87c3913da24e5718b595da0b6673b003fb3716b671fea14fc57b0','2026-03-27 11:13:25','2026-03-13 11:25:04','2026-03-13 16:13:24'),(321,1,'e688dcaf2593d96b6a921f94fe0bbfdef000c384d93af1b26e1cf9febf8b1b11','2026-03-27 11:25:04','2026-03-13 11:43:10','2026-03-13 16:25:04'),(322,1,'1dee6e05c96c817b091b954deef9d6134d190e1a2288b41316b33221166606da','2026-03-27 11:43:10','2026-03-13 11:43:10','2026-03-13 16:43:10'),(323,1,'c7e22ae15755ef018aea04be2bfe7b00ce224df2055019ea19718e7dabfd47ed','2026-03-27 11:43:10','2026-03-13 11:45:47','2026-03-13 16:43:10'),(324,1,'741a282a735e0c49df8fa18c3726f73197c3509ea6319b3976535b530660dd33','2026-03-27 11:45:48','2026-03-13 11:48:42','2026-03-13 16:45:47'),(325,1,'1f7540c9a07907fbcbf82a83ef99e27745fe756d4df1de8b7b9db842161df9eb','2026-03-27 11:48:43','2026-03-13 11:57:19','2026-03-13 16:48:42'),(326,1,'0bfd5e83a9be40007e12ac974f3442d5b8ebc84cd8b607eb9e02c55840cec423','2026-03-27 11:57:19','2026-03-13 12:06:16','2026-03-13 16:57:19'),(327,1,'9d3dab9034d8a5096bc2980c2a7c8f7ef288481a8c7d52e5727467bab3b9a350','2026-03-27 12:06:17','2026-03-13 12:27:54','2026-03-13 17:06:16'),(328,1,'6e7ee87532604e7c93e021d780b767e4178b10e36907e49a5c432b0d91551479','2026-03-27 12:27:55',NULL,'2026-03-13 17:27:54'),(329,1,'6fddf08b7d96495ed5c23da0dfa651d35b388ff9c86db0e5262b15f5eee9dbf6','2026-03-27 12:27:55','2026-03-13 13:06:29','2026-03-13 17:27:54'),(330,1,'09591328cd4d628c0787361222ebd23a569068e353787cbb3950680fa2aa9244','2026-03-27 13:06:30','2026-03-13 13:11:10','2026-03-13 18:06:29'),(331,1,'91795bceda7dfb805b11fa298cba8d537ba13932682ce509d5baa837151fae6f','2026-03-27 13:11:10','2026-03-13 13:11:14','2026-03-13 18:11:10'),(332,1,'b1a5355e49733013d42a2ee7902f635dad6ca525c9a1ddb69a1549e575392f5f','2026-03-27 13:11:15','2026-03-13 13:14:18','2026-03-13 18:11:14'),(333,1,'e8f0083c5d3ed663404c24d01f9ea995e6e0a3e422e8374018e934ecc9045c13','2026-03-27 13:11:26',NULL,'2026-03-13 18:11:26'),(334,1,'178f7584c4f7829d216b979eb477dc4ae43e98cf8c1f58b5503e22e58b90bd31','2026-03-27 13:14:19','2026-03-13 13:14:23','2026-03-13 18:14:18'),(335,1,'ccff73748c555abf8d6b66a40fa2ccf9d62ee30201d13d27c94f4ff30143a35d','2026-03-27 13:14:24','2026-03-13 13:15:24','2026-03-13 18:14:23'),(336,1,'8a996437601e35a2635f26cc46e1cae04e46cb96ee79709fe6c1761d9ad8ab2a','2026-03-27 13:14:44',NULL,'2026-03-13 18:14:44'),(337,1,'0b8dc0eb2f6095fd9b69b34167cf8d83038cba44e730b27fdd7a1bdc19156804','2026-03-27 13:15:25','2026-03-13 13:31:56','2026-03-13 18:15:24'),(338,1,'1273026d0eb72a4309f8f1b95d025661476ee122a3e979d9082e4cb918da4762','2026-03-27 13:16:29',NULL,'2026-03-13 18:16:28'),(339,1,'b478d07f0b0e2271412f52914a4fdc762563f728246bcf81fc91d37290df5f3e','2026-03-27 13:31:56','2026-03-13 13:31:56','2026-03-13 18:31:56'),(340,1,'e0bedb4fed11952740cfc83d8f662e2722df1fba0240c7b95647e23bb97e2610','2026-03-27 13:31:56','2026-03-13 13:33:52','2026-03-13 18:31:56'),(341,1,'987ed6f5c2077f021299772bfc446422c151ac0f49f297cc9819e5c434f11990','2026-03-27 13:33:52','2026-03-13 13:33:56','2026-03-13 18:33:52'),(342,1,'d79f7e6c4ac4b989fc54f3fbc3390671672f7fc1071e606660cab802aa3667be','2026-03-27 13:33:56','2026-03-13 13:34:44','2026-03-13 18:33:56'),(343,1,'2f2431e03741dd3f37818da6ae89f24730485b05f6bc60f13d6d26d314a9fcce','2026-03-27 13:34:45','2026-03-13 13:35:14','2026-03-13 18:34:44'),(344,1,'75b9c4b9a6049e11a77423b8399f442cf10afa13a68d5db7266513d1c4a43468','2026-03-27 13:35:03',NULL,'2026-03-13 18:35:02'),(345,1,'766605e12ae7cb12d903cac13b763c67073f2abf5660e59844f1b5ec3f34159d','2026-03-27 13:35:15','2026-03-13 13:49:36','2026-03-13 18:35:14'),(346,1,'8472b6b5ba6372c959691d7766c2c02a972ebbfe2911939bb1203b8933fdd9a0','2026-03-27 13:49:37','2026-03-13 13:50:53','2026-03-13 18:49:36'),(347,1,'65debd1c380f53da67071d2c74efb25a11f4bb6fe3dacf07b9ad0012e02617a1','2026-03-27 13:50:53','2026-03-13 13:51:29','2026-03-13 18:50:53'),(348,1,'88aab4d6bac94d15a0353ff97c069c0f59c178b0d44ba799983f1f80d5501ba1','2026-03-27 13:51:30','2026-03-13 13:51:32','2026-03-13 18:51:29'),(349,1,'0bc86ed67b418106fd7d3f5321f32227eba216a3f742529ed28bdf31c2519a9b','2026-03-27 13:51:32','2026-03-13 13:54:02','2026-03-13 18:51:32'),(350,1,'49ce47edaf281ecd26ca5c99e9d5e88c8178a92cd9eec9d1fe7eee82f2663eef','2026-03-27 13:54:02','2026-03-13 13:56:21','2026-03-13 18:54:02'),(351,1,'74704cfb93aee5861a116a3bd405e35cfd6c9b5c2575b0da5409688a5ed9229e','2026-03-27 13:56:21','2026-03-13 14:12:15','2026-03-13 18:56:21'),(352,1,'2f2f5f1fd0f6113b82245b987aa1b4ba5f14fbbb9e1db095b552242720c3d98d','2026-03-27 14:12:15','2026-03-13 14:12:15','2026-03-13 19:12:15'),(353,1,'d12b6276542ecf719aff054d1a06887f1b6a6972880c1c978c797efd83e3ed1e','2026-03-27 14:12:16','2026-03-13 14:12:15','2026-03-13 19:12:15'),(354,1,'40bfc56410f094d12ad17c1fa4dcbc092dc7c9a79744db737df2bafad66a20bc','2026-03-27 14:12:16','2026-03-13 14:19:37','2026-03-13 19:12:15'),(355,1,'e0848397bd38ed121346d720735c05de665c887291246d85e4169a34e41b66b1','2026-03-27 14:19:37','2026-03-13 14:19:37','2026-03-13 19:19:37'),(356,1,'d3f3f6b6e1731915e1acd3070f0b44df4c692d1e1b1000aba02824cc31b7324d','2026-03-27 14:19:37','2026-03-13 14:30:04','2026-03-13 19:19:37'),(357,1,'cf181aa258f2f0715b82ca9c8b72f0f06a27f37a0c072a185d3e1d57ec9b638d','2026-03-27 14:30:05','2026-03-13 14:30:04','2026-03-13 19:30:04'),(358,1,'079e4188ad0630cf0a73dbc4ae5b658dba0c7f26fac31bfdcee09411697749af','2026-03-27 14:30:05','2026-03-13 14:30:05','2026-03-13 19:30:04'),(359,1,'78ef6c9f0b34fdee489e19e3c6c790cf57d2c766637ac2790484e4995acf4d1e','2026-03-27 14:30:06','2026-03-13 14:38:10','2026-03-13 19:30:05'),(360,1,'3fd07c26b7079e83a97a209d8bad15e6a709f8a7f7e6af87a05913beddb32ddc','2026-03-27 14:38:10','2026-03-13 14:38:10','2026-03-13 19:38:10'),(361,1,'66fc4deab6ddd64cb4082049c6a3298bc1cb79151b837bc4654e8334819c4399','2026-03-27 14:38:11','2026-03-13 14:41:04','2026-03-13 19:38:10'),(362,1,'9a012971ae268ae993cd8e4f39a8960ee89ef7a895c1874992a13a2982ae0ee3','2026-03-27 14:41:04','2026-03-13 14:56:59','2026-03-13 19:41:04'),(363,1,'b3afbd8d928c3ecf804f4bb95ec256a2fd54a2194d90bd80dedc990315f4b2bb','2026-03-27 14:41:52',NULL,'2026-03-13 19:41:52'),(364,1,'64cae7246a3bd1a6176daebabbe32e589ef2f4c4ab3e4fdeefde3221a13c4d17','2026-03-27 14:57:00','2026-03-13 15:10:21','2026-03-13 19:56:59'),(365,1,'37409260dd20ce6e2f9c91f1db7e3c841b8fa5018584acc194eaae81d740acd5','2026-03-27 15:10:21','2026-03-13 15:12:39','2026-03-13 20:10:21'),(366,1,'732c53b3294129d8bddbd4c746ce6e7df6b6db7271333acb22a583505ea6adb3','2026-03-27 15:12:39','2026-03-13 15:12:50','2026-03-13 20:12:39'),(367,1,'5d8d92273b6437beed9f4c2aa787c499b7015f642030911957b5d1fa3ca3dcda','2026-03-27 15:12:50','2026-03-13 15:15:32','2026-03-13 20:12:50'),(368,1,'944c54a250af8d6baf3615e9fa9836d5cb810ef0af5ddd9faef88d30d87cf4ff','2026-03-27 15:14:34',NULL,'2026-03-13 20:14:33'),(369,1,'5915153d7778e81b85a8ccdbbe88753216a3d75c29a17e76f05adf7accef867b','2026-03-27 15:15:33','2026-03-13 15:16:04','2026-03-13 20:15:32'),(370,1,'8fe7d1f7fd0636a471df426c4377186a2fdc0a71d7d4aa221469f1641c6d585e','2026-03-27 15:16:05','2026-03-13 15:23:48','2026-03-13 20:16:04'),(371,1,'5c6f11f7774c1f8dd41b107fe67021065391dab886b10604af16a9e2a8c32e2b','2026-03-27 15:23:49','2026-03-13 15:41:22','2026-03-13 20:23:48'),(372,1,'5a3a17057f588958ebdea4aa73d8afb3df1dd90b4a38d0fc98303fc94d08cd38','2026-03-27 15:41:23','2026-03-13 15:43:31','2026-03-13 20:41:22'),(373,1,'975c4d41fd9db999e5d7c5d55bd99ec6d94ce1bab9527320fda27779477ebdb8','2026-03-27 15:43:32','2026-03-13 15:44:07','2026-03-13 20:43:31'),(374,1,'839591aa91664fde7afa27604224e5e902ee2ff2acc66eb2167b6bebd87b175a','2026-03-27 15:44:08','2026-03-13 15:44:46','2026-03-13 20:44:07'),(375,1,'20a1967c7bfb4a26892ac0fafd5734d0f0dc7c8abb44db3e3521bce204f316ed','2026-03-27 15:44:46','2026-03-13 15:45:14','2026-03-13 20:44:46'),(376,1,'be4a8e70de4ca1d72dddda7d8c5b227c62d2e8b2f9f1a72f9d876c8a14c085e1','2026-03-27 15:45:15','2026-03-13 15:45:31','2026-03-13 20:45:14'),(377,1,'5069f6c2ac89b121b5158c3a842fa041416d3590aa8773dea6840ec2551edb65','2026-03-27 15:45:32','2026-03-13 15:47:32','2026-03-13 20:45:31'),(378,1,'a87948e14f781db01c029cba6356053fc533769cc20a55ebd2f5976ae07793d3','2026-03-27 15:47:32','2026-03-13 15:48:13','2026-03-13 20:47:32'),(379,1,'e96459eaa80a691fff9de690a85f237fe5129db664a7a5d32a7b683482d4996e','2026-03-27 15:48:13','2026-03-13 15:48:17','2026-03-13 20:48:13'),(380,1,'6e025f7428c15adfcce2f0eaf217fdca8cc1587380a8c31ba4f6b76c49c36da1','2026-03-27 15:48:17','2026-03-13 15:49:20','2026-03-13 20:48:17'),(381,1,'cf1f3157184a8a92a050c097510c61da1a1e1a6ca59ad48270cd5bb5bba22abd','2026-03-27 15:49:20','2026-03-13 15:51:34','2026-03-13 20:49:20'),(382,1,'e6630344c090953330b285bdfc3eba98cb8817752eee10a6dfed7e6790607c1a','2026-03-27 15:51:26',NULL,'2026-03-13 20:51:25'),(383,1,'c17565550f0ec866c2f7aeefcdb799472e1afcf3a82dc4060714d5da0098796a','2026-03-27 15:51:34','2026-03-13 16:12:58','2026-03-13 20:51:34'),(384,1,'72efc19ce8f61688443bbbb2a11408358bd270faa7c20a1dfcdfb97b9b5c1d09','2026-03-27 16:05:54',NULL,'2026-03-13 21:05:54'),(385,1,'333e3bba2f427a98151d6d6f3c3ad52b652eadb8c9e619e3544613b96996faa4','2026-03-27 16:12:59','2026-03-13 16:23:33','2026-03-13 21:12:58'),(386,1,'5bcbbb5a6c2dbd8cb1f9e1f7a845f614a53a56bc9c63cb5e7eecbc3a3f465bac','2026-03-27 16:23:33','2026-03-13 16:28:00','2026-03-13 21:23:33'),(387,1,'3661cbfb6b97bf15a892b8bcb8015725c977142fe868f895ff8fd189d8840ea6','2026-03-27 16:28:01','2026-03-13 16:28:07','2026-03-13 21:28:00'),(388,1,'1bb46805dc5d0470f13465ba807dba3decc2da88d3de045834fe830be745a38a','2026-03-27 16:28:07','2026-03-13 16:42:22','2026-03-13 21:28:07'),(389,1,'b54a1b68d9b12eb42a91e63eb068b5fbb220e4c7bf46f3140e3667b967c5e3e1','2026-03-27 16:42:22','2026-03-13 16:43:23','2026-03-13 21:42:22'),(390,1,'338dea8584fd36bc9dfbda09c0754801f901a5e6c7e3b2019d9e23f9ff2ccdba','2026-03-27 16:43:23','2026-03-13 16:43:24','2026-03-13 21:43:23'),(391,1,'052a4f1ff96e70ef9498a3529d51c74df074fbcbd2330479d6cd171b0a510537','2026-03-27 16:43:24','2026-03-13 16:58:47','2026-03-13 21:43:24'),(392,1,'5043c5355bc8c37311c241a6153ab67e9223c97d7ac262c9a2e80b7d1191974d','2026-03-27 16:58:48','2026-03-13 17:08:48','2026-03-13 21:58:47'),(393,1,'185fca8634cff861e43f806b6dca2a47e7d24201016459032c3c7194d6910746','2026-03-27 17:08:49','2026-03-13 17:09:08','2026-03-13 22:08:48'),(394,1,'a3e8abdaad60d5f714a2feca90936429875f7fbdca4dce996dc4c7961417aabd','2026-03-27 17:09:08','2026-03-13 17:11:28','2026-03-13 22:09:08'),(395,1,'4ac30097412cc2d7625362f734802ff2c95cc3fa12072b09617a817fbd123753','2026-03-27 17:11:29','2026-03-13 17:12:55','2026-03-13 22:11:28'),(396,1,'be13e025d0f7fa7fa1c7da3b8bff0cb3b26810a1aed2c424cab5a09b76d9065d','2026-03-27 17:12:55','2026-03-13 17:15:13','2026-03-13 22:12:55'),(397,1,'2c619daea6a44b121b36cd553c353bc9b70d949a036a703ead03c1eeb7f92633','2026-03-27 17:15:13','2026-03-13 17:15:13','2026-03-13 22:15:13'),(398,1,'f07703c2b6f389f2c63e34a6ee864987246510919199e4b76a87f0458841e719','2026-03-27 17:15:13','2026-03-13 17:24:51','2026-03-13 22:15:13'),(399,1,'39f11038224ea3324c4b8ccf48e6ef3172907e9fbd87fe5f0e55496afc0ba81b','2026-03-27 17:24:52','2026-03-13 17:52:26','2026-03-13 22:24:51'),(400,1,'aa197023d961071c2edd9f5e60bb0ad5e2af7f2459adf247115f0b5e0a336de4','2026-03-27 17:52:27','2026-03-13 18:27:43','2026-03-13 22:52:26'),(401,1,'4a27927e10d82ab54cf4e06a937733c65fb61ae4db3cc56e2b5c8f358002975c','2026-03-27 18:27:44','2026-03-13 18:29:38','2026-03-13 23:27:43'),(402,1,'fe91806b6d75e2ddf7be91076b516ac4d4ea06f67cdc5c0ccdc797096fe67daf','2026-03-27 18:29:39','2026-03-13 18:32:49','2026-03-13 23:29:38'),(403,1,'c7e1edc5eb9e3dff5d9219f304b20dd029d9100d6213c22540dedec57c88f020','2026-03-27 18:32:50','2026-03-13 18:42:44','2026-03-13 23:32:49'),(404,1,'5570a962304fe381a3001e7958bc340fcba453170597ebe4c8b5fbfa7e9f19b2','2026-03-27 18:42:44','2026-03-13 19:09:48','2026-03-13 23:42:44'),(405,2,'01045881c0f5f3fabc41444b0a70079808c2e924306b086863228a53ac6d2c62','2026-03-27 18:53:01',NULL,'2026-03-13 23:53:00'),(406,1,'a8f0e5d081a9728d508b04671f2b39816a9ac1f28ce6d849e281985189311b0f','2026-03-27 19:09:48','2026-03-13 19:16:52','2026-03-14 00:09:48'),(407,5,'d0f0fb51d73d6e67bd30da1aefc24f92db3c78e596f4c100726d83661618d23f','2026-03-27 19:10:03',NULL,'2026-03-14 00:10:03'),(408,6,'820f2117a0cf9d220abcee3848d2ab2ddf1c05a529da097eea5fbe09f4d828dd','2026-03-27 19:10:48',NULL,'2026-03-14 00:10:47'),(409,1,'5930849b2c756a11e8e5a90b69c0cd5443be3be9bc3c933c69c35e03c570064c','2026-03-27 19:16:52','2026-03-13 20:22:02','2026-03-14 00:16:52'),(410,1,'2200526b57b0c95f5ea4b2d75b410345d3638b0cd70743146d3e3ee593f83f81','2026-03-27 20:22:02',NULL,'2026-03-14 01:22:02'),(411,1,'0db064c05b242a7f34ba3ac0bfbe3421febd6b0f7185baa759d2c5b73c95f55d','2026-03-27 20:22:02','2026-03-13 20:22:12','2026-03-14 01:22:02'),(412,1,'eff77dba5069d01fb5679a5f38fc3ce514b7e075824cd17bc7f9a500d19f4888','2026-03-27 20:22:12','2026-03-13 20:22:12','2026-03-14 01:22:12'),(413,1,'82c4fac43393ec95468bd9c739a625bc2012796c5fc346db81972a1de66e55c7','2026-03-27 20:22:13','2026-03-13 20:22:19','2026-03-14 01:22:12'),(414,1,'fa14b9ec114106c18e19f51e74ce020f91ffe9c466f42b73f5738ec8c6d4420e','2026-03-27 20:22:19','2026-03-13 20:22:19','2026-03-14 01:22:19'),(415,1,'18c1019c7ca9f46c4df666a9e82278c5323ddf57fba097c694cfa60174b9d92a','2026-03-27 20:22:19','2026-03-13 20:22:21','2026-03-14 01:22:19'),(416,1,'67b3dfc13c0f286163e9119b9c357db605b9d789badce66160c8623ab24086a1','2026-03-27 20:22:22','2026-03-13 20:56:06','2026-03-14 01:22:21'),(417,1,'ee98269b9a17ec1a182f8a565c67432ab7b92f93f39331ea13f1df7511f5ecf8','2026-03-27 20:24:15',NULL,'2026-03-14 01:24:15'),(418,1,'b0be373610f718de73b537e6f92039f8b0bd5917b1ccc7f476f354bc391f16e5','2026-03-27 20:56:06','2026-03-13 20:56:11','2026-03-14 01:56:06'),(419,1,'89d472da6973cd46f64a558502d1bc9bae8c4f037016a1e7b46642d199145ec3','2026-03-27 20:56:11','2026-03-13 20:56:11','2026-03-14 01:56:11'),(420,1,'0a7eeb7538adb7b214955ed070f7ed2d9f2d6dbbafba72e5b1e5310bafdd1987','2026-03-27 20:56:11','2026-03-13 20:56:11','2026-03-14 01:56:11'),(421,1,'4e8653fbf53474b973efed86b74ed65b04549b6996a0d47dde782aa6d5a3308b','2026-03-27 20:56:12','2026-03-13 20:56:13','2026-03-14 01:56:11'),(422,1,'a207834e950950862dbbe347ebedf85d4aa522e050a533da49e1c90df4a1c8ba','2026-03-27 20:56:13','2026-03-13 20:56:13','2026-03-14 01:56:13'),(423,1,'7e1a81d3bad2146b7e3faeaa242af2345b95d8bfb1ea630b434ac08e97adea3c','2026-03-27 20:56:13','2026-03-13 20:56:13','2026-03-14 01:56:13'),(424,1,'16674243c66df64d85f2d470ef55f6f93a4c28d1a8f108bf4b8b5d911a67df0b','2026-03-27 20:56:14','2026-03-13 21:08:39','2026-03-14 01:56:13'),(425,1,'035deff22eb5d4cb47ee4e3b87df47d7eaeece91bb07365d19754ed058993ec7','2026-03-27 21:08:39','2026-03-13 22:16:16','2026-03-14 02:08:39'),(426,1,'b31d184cd153ef68c99ad347ef8ea79667fe39b623a2e190b73c29ece1026bd3','2026-03-27 22:16:17','2026-03-14 09:35:25','2026-03-14 03:16:16'),(427,1,'703f9bf35c01b02e23ffad68632ee774a266ff757334cc6d099745cf2ef208ea','2026-03-28 09:35:26','2026-03-14 09:37:29','2026-03-14 14:35:25'),(428,1,'feebcfce233af005f0a57c833b9c7825d90f960114b2b48800b0afc477f063d5','2026-03-28 09:37:30','2026-03-14 09:57:32','2026-03-14 14:37:29'),(429,1,'86b609b521807a9f96867ffe54a3d079e6edd217cff3c93f5e3d18a86eb9dd5f','2026-03-28 09:37:52',NULL,'2026-03-14 14:37:52'),(430,1,'fc6686955cbbfef5738b3bea3bfcfec261eb2e75f58efab9b00a808b593e8b60','2026-03-28 09:57:33','2026-03-14 10:17:49','2026-03-14 14:57:32'),(431,1,'58cb10b4fcbe31d7dd2e136ed7f1c838efe710ea16fc66fcfc93896b62f13d10','2026-03-28 10:17:49','2026-03-14 10:38:08','2026-03-14 15:17:49'),(432,1,'8232bfaada158732634de73f8d1bc12118ca76b83cc582900e133aef47c09818','2026-03-28 10:38:09','2026-03-14 11:43:35','2026-03-14 15:38:08'),(433,1,'2a574194ff93504f5b8774dc5f2f2ad3d5a8c5f6507082a927442d8e719a7d3b','2026-03-28 11:43:35','2026-03-14 12:02:48','2026-03-14 16:43:35'),(434,1,'b1ad32142ddc0aa73eb84dc784c6b840c72a2a0c5516fc4954e49b06e1f95f71','2026-03-28 12:02:48','2026-03-14 12:16:33','2026-03-14 17:02:48'),(435,1,'d0742ffcb206f8b21535614552849b164ddb83bbe53114b1f696ee2ad6bb31b3','2026-03-28 12:16:33','2026-03-14 12:17:02','2026-03-14 17:16:33'),(436,1,'a282942686e145f62f79e0dc4beaccc21eb52127d9d35bee72ac0f6caf02f3fc','2026-03-28 12:16:45',NULL,'2026-03-14 17:16:44'),(437,1,'4ad4fd3398c5f75d987b00a347ce4ffba665ff74aaa1d989fbc01e9ef673f964','2026-03-28 12:17:03','2026-03-14 13:30:21','2026-03-14 17:17:02'),(438,1,'75651ede61de1b8f6c05cf76339fcf4c47c0a41d27a5b8049769c7f91c0f7477','2026-03-28 13:30:21','2026-03-14 13:44:00','2026-03-14 18:30:21'),(439,1,'afe869c342674e5e26ad27c870ba9ce76f47c738bd70efc87abcfd7eeb69c5e4','2026-03-28 13:30:35',NULL,'2026-03-14 18:30:35'),(440,1,'7edacc7b50143e91a84da79a73051ff70def9d01a97af040446771782fbae199','2026-03-28 13:44:01','2026-03-14 14:04:54','2026-03-14 18:44:00'),(441,1,'74d13f37cdd9d1eb64db0d344c34198ae7e673bc54ccbb1796c455eb986b52db','2026-03-28 13:44:21',NULL,'2026-03-14 18:44:20'),(442,1,'7562dbc760dc6e68959808b3f909410b68a75539e1dfb31c0209d9f36d02c292','2026-03-28 14:04:55','2026-03-14 14:04:54','2026-03-14 19:04:54'),(443,1,'bf831fe7ce572bc7dbb3466215ec5f752edb1f50fe49081b561c3e2cb7a0557b','2026-03-28 14:04:55','2026-03-14 14:54:59','2026-03-14 19:04:54'),(444,1,'d9f4888d61cedbc6ccef549ff42e6d65bc8139996d543db6625920cba58768d2','2026-03-28 14:54:59','2026-03-14 15:44:30','2026-03-14 19:54:59'),(445,1,'347f61a967acbe6c6bcb077bc7b29c20c660cce64bd5d110dedcee94919a0376','2026-03-28 15:24:54',NULL,'2026-03-14 20:24:53'),(446,1,'ad0fd45c148ca778f619081afa53355a41e5fda80139ec276271806fb6dc21ab','2026-03-28 15:44:31','2026-03-14 15:46:04','2026-03-14 20:44:30'),(447,1,'9d179e01b25dcf1351af183c5e9d913232597a5bcebef99a7aa600930d0a03e5','2026-03-28 15:46:05','2026-03-14 15:48:15','2026-03-14 20:46:04'),(448,1,'447ec2ea5244b2fa6aeb1523e733c4437ffa9a6517d114857d8f1b47c64880a1','2026-03-28 15:48:16','2026-03-14 15:57:25','2026-03-14 20:48:15'),(449,1,'a4e75d36b12e78683bd46233fbf497f97fede0c454336cfdb220e3e7541a9808','2026-03-28 15:48:27',NULL,'2026-03-14 20:48:27'),(450,2,'3f31deba96d0c0db5eb0a900e22ffe8fee6affefb07825f704bb518f3897748c','2026-03-28 15:49:17',NULL,'2026-03-14 20:49:16'),(451,1,'dc138745fc7f8962912a62daaf006988f589a4c24d7c7c36448ef7f252b1785f','2026-03-28 15:57:26','2026-03-15 14:09:56','2026-03-14 20:57:25'),(452,1,'1441b59ce6c44b5f717edf8431cef2d438558a371a3edb38d1b4efa2d67a2b5a','2026-03-29 14:09:56','2026-03-15 14:10:26','2026-03-15 19:09:56'),(453,1,'f987d58b679eab02d01ba813814e01c9d79349228230c779c885a5d116329c7d','2026-03-29 14:10:26','2026-03-15 14:44:16','2026-03-15 19:10:26'),(454,1,'3bc233d1c011b74cfcb0ab416ead6b4603f70b3ebdd871d63444a70d3d0b04e9','2026-03-29 14:10:42',NULL,'2026-03-15 19:10:42'),(455,1,'d7d0766676acfe772d9d4779b27e56fd92859c889dc88f9d663af34f95ac734a','2026-03-29 14:44:16','2026-03-15 14:49:52','2026-03-15 19:44:16'),(456,1,'ca241347d447fb66ce3fe84ac3484ac614c4bcbe39be3b0ae553b298675e8d4e','2026-03-29 14:44:47',NULL,'2026-03-15 19:44:47'),(457,1,'1e1a25e682f2608a895f77f26c330e45f6a67482ee69d844bedd68946954bdbb','2026-03-29 14:49:53','2026-03-15 14:50:32','2026-03-15 19:49:52'),(458,1,'df21520e596d1ca72744e43ac19d37f9e2397cc1b0d09d1a9a1c18f1f1cfe85e','2026-03-29 14:50:20',NULL,'2026-03-15 19:50:20'),(459,1,'c827083589d027b58b62b3da103fe1ad78e6032de5d04c8ffc1cf22871ced50e','2026-03-29 14:50:33','2026-03-15 15:11:14','2026-03-15 19:50:33'),(460,1,'93c94c1a96a314d5754720dd11ffe49b6f41a3d280e93576d16248edd0b2e7e7','2026-03-29 14:53:09',NULL,'2026-03-15 19:53:09'),(461,1,'05489419ddd5f90776a91929355123376761054a0a6c3e9ad74f0badda8c783f','2026-03-29 15:11:15','2026-03-15 15:12:33','2026-03-15 20:11:14'),(462,1,'d62cec6817bbb34bcbdc7387b4203f440d862161aaae9d5fd4d39513a9d1242a','2026-03-29 15:12:02',NULL,'2026-03-15 20:12:02'),(463,1,'a6ef0c35adef0ee3965e39c79021a3a00c5290e499442047c3266474d94e6e1b','2026-03-29 15:12:34','2026-03-15 15:14:25','2026-03-15 20:12:33'),(464,1,'f2de158698682d7de31b1ae6cdbd9b260be0a06659e17401e3fdcaf30c51cfb5','2026-03-29 15:14:25','2026-03-15 15:15:26','2026-03-15 20:14:25'),(465,1,'8258096412a182904e3fb186e1edfdeb37dbf42001b1f175b8c1dac0be4b2d0a','2026-03-29 15:15:27','2026-03-15 15:35:56','2026-03-15 20:15:26'),(466,1,'d89f8b94de9a30e80e2f7bb8dccbcd03a84f552680d0982b01a4d9dbba2b111f','2026-03-29 15:35:57','2026-03-15 15:36:55','2026-03-15 20:35:56'),(467,1,'a82361d4e154476b88831de2284eefe137da7625c717438635896b691b11c6dd','2026-03-29 15:36:55','2026-03-15 15:45:15','2026-03-15 20:36:55'),(468,1,'760b570a9608c5f65d97532e0c92fcc744c8c45dc9245f65dded08ea764929d6','2026-03-29 15:45:16','2026-03-15 15:46:07','2026-03-15 20:45:15'),(469,1,'b8c3343bae0276109d78dfd0824723525955e1844ceb7f713cf01e32d8573ecc','2026-03-29 15:46:08','2026-03-15 15:50:08','2026-03-15 20:46:08'),(470,1,'a33b741e24508568423d37ec6a8d226f48fb265487263b20ec8abbdec5d5c77d','2026-03-29 15:50:09','2026-03-15 15:50:25','2026-03-15 20:50:08'),(471,1,'3fe9f6b3d8b79666a84f044942fe4657b3fe21f9c8ac543d17062e44d75939e0','2026-03-29 15:50:25','2026-03-18 21:37:03','2026-03-15 20:50:25'),(472,1,'c06bc0ebfcc6c87513caa453a6d146dd70e5ceaa9c1c3ccc7037d8065ef3231e','2026-04-01 21:37:04','2026-03-18 22:08:36','2026-03-19 02:37:03'),(473,1,'49030db57acdda4abf22663ccdecf3cdf44b2fd56b286515eaa75975989a603a','2026-04-01 21:37:17',NULL,'2026-03-19 02:37:16'),(474,1,'b51262fb0caf13c411605e1294ad48af166a8a02766912c9b11fcd03168311f6','2026-04-01 22:08:36','2026-03-18 22:18:34','2026-03-19 03:08:36'),(475,1,'5382ac98d71c7e175445bac315c4d7fe6242bbdbc0ddc68afe8a05a989b39b9e','2026-04-01 22:18:34','2026-03-18 22:36:02','2026-03-19 03:18:34'),(476,1,'75262d030bf5e62ce27a50911446e4c3a7ee690fe83ac96ccf7d2d634f37cce7','2026-04-01 22:36:02','2026-03-18 22:38:09','2026-03-19 03:36:02'),(477,1,'06613d77dde4c2c29cef217a81c2482eb81931c65d4f960d1070454750b73d0b','2026-04-01 22:38:10','2026-03-18 22:38:28','2026-03-19 03:38:09'),(478,1,'1e5c14b36427e765d54919da1e13c30a66b0d7b4ee7b693a93e71904c137ea4e','2026-04-01 22:38:28','2026-03-18 22:39:33','2026-03-19 03:38:28'),(479,1,'d4f2daedde5ac8e30a5d8f1c9c5609872970d8e1b5433b54f35b734aa8c00507','2026-04-01 22:39:34','2026-03-18 22:39:56','2026-03-19 03:39:33'),(480,1,'99d56594ddd7607debccd865516c8300381444b5f04a1abf7435004a66c9997b','2026-04-01 22:39:57','2026-03-18 22:40:14','2026-03-19 03:39:56'),(481,1,'ca8783cf97390e541762cbe047c7daf90f9a89cc269a07c13a3c51e69b1e4534','2026-04-01 22:40:14','2026-03-18 22:42:13','2026-03-19 03:40:14'),(482,1,'5263ae1c66202c5cd4f34e827479b62ffd0a9153f457356901c4325013fa7f24','2026-04-01 22:42:14','2026-03-18 22:45:27','2026-03-19 03:42:13'),(483,1,'9fcfad3a99d00a149f49b76aa4a48e2a068a134d6a3329c2de220f23e8f3619f','2026-04-01 22:45:27','2026-03-18 22:48:02','2026-03-19 03:45:27'),(484,5,'c537d6f656a087e2fe651d87d982eb811d86206034442f6e54bfeab243d1f615','2026-04-01 22:45:47',NULL,'2026-03-19 03:45:47'),(485,5,'d7ab259d5eb6e28ea49a55868a6a381e5c6e88dc48c0440885f7ad2a63e85102','2026-04-01 22:47:20',NULL,'2026-03-19 03:47:20'),(486,1,'bffef2a7b70668bdeaf5d15a0a3793203f81e20fdd0a6c7b24fcefb2ae60feb9','2026-04-01 22:48:02','2026-03-18 22:48:16','2026-03-19 03:48:02'),(487,1,'36ff50aead8a4e605fc6176fc844709f371e0687582f580090bedb0732eee2a2','2026-04-01 22:48:17','2026-03-18 22:49:10','2026-03-19 03:48:16'),(488,1,'29f0cd308489ccf7edf67d300a670c84d18e22c689ff20d0bef5d16719dd7334','2026-04-01 22:48:40',NULL,'2026-03-19 03:48:40'),(489,1,'b61889140d527b5cc8628d215e2d6537ceaae4aab5626bebc0df43905598c8e5','2026-04-01 22:49:10','2026-03-18 22:49:59','2026-03-19 03:49:10'),(490,1,'0f5b75eb7405e25db2053e40f206f472b7fa1355dc2f3dc2ffcb100d1140fec2','2026-04-01 22:49:59','2026-03-18 22:50:34','2026-03-19 03:49:59'),(491,1,'0eb30c7ea7356371a05f81eb1d91ec191ba4bbc365e30e3b05df7dc1be74fa1a','2026-04-01 22:50:34','2026-03-18 22:51:05','2026-03-19 03:50:34'),(492,1,'be36973bfd179e07e800cee82ab7a8a3182198e0d801ed5b870623b404f007dd','2026-04-01 22:51:06','2026-03-18 22:51:55','2026-03-19 03:51:05'),(493,1,'eb2e8d46f4b4db26079603a8add241501cc0563bc6c0ee255125ada98fd6c7ea','2026-04-01 22:51:55','2026-03-18 22:52:34','2026-03-19 03:51:55'),(494,1,'caaa7ce1c92f0b2b10f84cd96b190d5af5241e0223ce9de79d062449ec40b282','2026-04-01 22:52:34','2026-03-19 16:14:48','2026-03-19 03:52:34'),(495,1,'7fa48f09dd605c8e76b5471e5750ef6d5007006c33f42dc5876d007f573cba20','2026-04-02 16:14:49','2026-03-19 16:26:54','2026-03-19 21:14:48'),(496,1,'4213876fb79cb1084ed2a41f49756d4df6f0f94168a3a772ca19d5111146b021','2026-04-02 16:15:03',NULL,'2026-03-19 21:15:02'),(497,1,'0f186ec2ef7b1cfd3023c9f874ac827adff1030e29485a52e654056e24181d4c','2026-04-02 16:26:54','2026-03-19 17:11:02','2026-03-19 21:26:54'),(498,1,'f12a7c5d966621267d8a6a4ed0880143b5a41fdfc340388f7fd784ac241d49bf','2026-04-02 17:11:02',NULL,'2026-03-19 22:11:02'),(499,1,'3110a97fd4f40f6958934c14ba4d4280cd212051b2d6e31a7a4c4d1d1452fe90','2026-04-02 17:11:02','2026-03-19 17:11:29','2026-03-19 22:11:02'),(500,1,'8d2152f8002f95094bec91c4a6676be2ddfc16d5c0fd0e31109d479a3099f2f8','2026-04-02 17:11:29','2026-03-19 17:11:50','2026-03-19 22:11:29'),(501,5,'1566e74c58cdd8f536127b70c070364897f890baf717a9f3766dda57f9c6eb20','2026-04-02 17:11:42',NULL,'2026-03-19 22:11:42'),(502,1,'859f69c201e6034398b78aa4bf7cf32e3bdb2813967d2f25dbfbc05be0e9ea5f','2026-04-02 17:11:50','2026-03-19 17:15:28','2026-03-19 22:11:50'),(503,2,'7f727f4fbf32a80605631cf7a50b5681e83b042a2a6d50e10392e6f93843c0bb','2026-04-02 17:12:08',NULL,'2026-03-19 22:12:08'),(504,1,'d029fc79ba0de92d844308a605b40e43b57d2c0809d7aef4674ef0c9e36c0638','2026-04-02 17:15:29','2026-03-19 17:15:31','2026-03-19 22:15:28'),(505,1,'4d5ec469b87e16615336d9622c5acb2e869c1459d519d9bee4be22671e4c3a28','2026-04-02 17:15:31','2026-03-19 17:15:39','2026-03-19 22:15:31'),(506,1,'e6936fc274a2de04bf5883946393ac59fb95907a59e341c3e6595d4ea5690e4b','2026-04-02 17:15:39','2026-03-19 17:15:41','2026-03-19 22:15:39'),(507,1,'1349a78b4f7394739de9f85cd664982ab908b7c5cb5ba1d691fe99bd9fbb2920','2026-04-02 17:15:42','2026-03-19 17:15:50','2026-03-19 22:15:41'),(508,1,'3cf939978cdbe190ca44ab5db4f18220c207a65f65608284164d6bd8a9b5710d','2026-04-02 17:15:51','2026-03-19 17:15:53','2026-03-19 22:15:50'),(509,1,'46312e14ce52f2305af49206be0ea22a901ca2d85b9ddbaf4ff9c395034e7985','2026-04-02 17:15:53','2026-03-19 17:16:54','2026-03-19 22:15:53'),(510,1,'eea996ce10d3811d5183e9baae56e69aa60240dfa3fbae354e8108725abd9991','2026-04-02 17:16:15',NULL,'2026-03-19 22:16:14'),(511,1,'859f63209e8f3ba31148779b2f42c9c75ca465e772b4a8aba7c626b15ce59bb1','2026-04-02 17:16:55','2026-03-19 17:17:11','2026-03-19 22:16:54'),(512,1,'1cff33c8128d18432f154dc1be4b0ded43bd46b8e5a0fc185b164a752e568248','2026-04-02 17:17:11','2026-03-19 17:31:06','2026-03-19 22:17:11'),(513,1,'eb68a915ce3f26233e5907e9f8ba401cc7e05d178d89915b61de3538eda25fb8','2026-04-02 17:31:07','2026-03-19 17:31:17','2026-03-19 22:31:06'),(514,1,'0580c98ad3ba48dc4bc590d4f38b8d9be31b50ffcd7da4c0e80efeb910a135ed','2026-04-02 17:31:17','2026-03-19 17:31:17','2026-03-19 22:31:17'),(515,1,'60e3704ddf2aca78d77f3108b01c4c48eeda07759a9fb5ffde731003fd4ac60f','2026-04-02 17:31:17','2026-03-19 17:31:17','2026-03-19 22:31:17'),(516,1,'5fe1b1beab920bcf85f6661dfdc5de91cc5e69440cd3962ff21aa5c0d8c910ba','2026-04-02 17:31:18','2026-03-19 17:44:54','2026-03-19 22:31:17'),(517,1,'76f89ce0f61fc991054eaac2769a03149044049a704b205040812bf795b42194','2026-04-02 17:44:54','2026-03-19 17:44:56','2026-03-19 22:44:54'),(518,1,'1acbe8bcbe4a20b685f5f3742a6068015194707156f07eb2c61d008ce0e1f427','2026-04-02 17:44:56','2026-03-19 17:46:38','2026-03-19 22:44:56'),(519,1,'77f8a6f114590c2ac7052a17a081988ad4002b566d55a43b2b58508806148bec','2026-04-02 17:46:39','2026-03-19 17:50:16','2026-03-19 22:46:38'),(520,1,'289a830f4ac609567966a0e8aeddc00c4996b50df1c099a9bbb834b1bcca53a2','2026-04-02 17:50:16',NULL,'2026-03-19 22:50:16'),(521,1,'dea19a30302c321c08ca1807dad5be56126328eb95a5cc28234046495a14b12f','2026-04-02 17:50:16','2026-03-19 17:58:19','2026-03-19 22:50:16'),(522,1,'89619e30602b88994c9dc80cee076813523e2d041980726f5bfc2b5b545beb9c','2026-04-02 17:58:19','2026-03-19 17:58:20','2026-03-19 22:58:19'),(523,1,'8b80c9d94844fb620b22688511c37bcbba822bae5c4833e778fa7e99eb57758b','2026-04-02 17:58:19',NULL,'2026-03-19 22:58:19'),(524,1,'e22271c71b7894b5434511e036eae6aae77a7e19a76b52f76e9efec371bf6a16','2026-04-02 17:58:20','2026-03-19 18:01:23','2026-03-19 22:58:20'),(525,1,'cda8982af0c97f29ee87857930571276543a915bc79bbb5e4ce51853648b724e','2026-04-02 18:01:24','2026-03-19 18:01:39','2026-03-19 23:01:23'),(526,1,'c85342ded07c22280c9fb9b937512e7cb2fdc1ce07654f89f68c0a84b008ee22','2026-04-02 18:01:40','2026-03-19 18:07:25','2026-03-19 23:01:39'),(527,1,'f630a7d36f846b9dd80fa58f5006ba4ecbbd05f71762ad5c853a40af5f5bbf4b','2026-04-02 18:02:10',NULL,'2026-03-19 23:02:09'),(528,1,'c96d661a8a0aa1d94dcb07833b21282b5c865e323819532db004face1d1b7cc9','2026-04-02 18:07:26','2026-03-19 18:07:46','2026-03-19 23:07:25'),(529,1,'c4d6ad8268995796b772cbaa4f9d0d1db28a9ed94ea952154ebe27f7eae71c48','2026-04-02 18:07:46','2026-03-19 18:07:46','2026-03-19 23:07:46'),(530,1,'2d427104a928e1712117a9c7ba374bb7637f9e368c59706f0a1adac242451ba9','2026-04-02 18:07:47','2026-03-19 18:15:41','2026-03-19 23:07:46'),(531,1,'9ac958dd3e9f9b4fcbfe89860bda91c6f0c16d7c6182abdfab4ca1704ae6935a','2026-04-02 18:15:41','2026-03-19 18:15:41','2026-03-19 23:15:41'),(532,1,'37392f1c4706063a5f8fa05898b593a6b3ed4df0e4fc20d00cf7c29eb18fb8ff','2026-04-02 18:15:41','2026-03-19 18:15:43','2026-03-19 23:15:41'),(533,1,'d6b6b47091eb6388087f7fd497ba156692d050746a7730dfb72d59789cd77e1f','2026-04-02 18:15:44','2026-03-19 18:17:53','2026-03-19 23:15:43'),(534,1,'ee7abfa5f42c16bceaaab27d44e4051a5a0cf3a59d4bea280b45091971330566','2026-04-02 18:17:53','2026-03-19 18:29:20','2026-03-19 23:17:53'),(535,1,'80f160ddcb63339238e6476069f652dadfff026a2109f8f365821dec70589323','2026-04-02 18:29:20','2026-03-19 18:29:28','2026-03-19 23:29:20'),(536,1,'f678b0332d336905effbaec583f8b487beb769ec98ed46c0952c4925796a05d6','2026-04-02 18:29:29','2026-03-19 18:38:51','2026-03-19 23:29:28'),(537,1,'4fe3c8fbda4cbb4a6c3327485749a07891aacec6d86fef1081441b5165fe5190','2026-04-02 18:38:51','2026-03-19 18:38:56','2026-03-19 23:38:51'),(538,1,'97c5e91d6f5ef3663ad89dc21369e8a2fc49a112ab105e32b2937301c4203869','2026-04-02 18:38:56','2026-03-20 10:06:18','2026-03-19 23:38:56'),(539,1,'d8f0f04572072d6dbb5c6e3368b95b29ac6b7ed6d3dab2f2c1d4eca19e225c7f','2026-04-03 10:06:19','2026-03-20 10:06:24','2026-03-20 15:06:18'),(540,1,'4beb7739bff227208c93486a33ca4c6e9191b1f7411880d548f15dbcaf711253','2026-04-03 10:06:25','2026-03-20 10:07:14','2026-03-20 15:06:24'),(541,1,'0227ceb88703d95282b4b9470e42c18734f8fffcbd794ddde9722ad5596b4be6','2026-04-03 10:06:43',NULL,'2026-03-20 15:06:43'),(542,1,'61fbd8e7fe5383ea12c584f877f3ad3ed633f7ee6ea4cefb8d18dac54cb48ba4','2026-04-03 10:07:15','2026-03-20 10:08:30','2026-03-20 15:07:14'),(543,1,'4746f0059e5a433ca21e012914f66ebee12044133d5b9ecbe31a8261e1a72aad','2026-04-03 10:08:30','2026-03-20 10:08:37','2026-03-20 15:08:30'),(544,1,'699f4cc439a98c9a4277c5209f10b9422e764f5a837452a9f54c7f8531666dc9','2026-04-03 10:08:37','2026-03-20 10:08:39','2026-03-20 15:08:37'),(545,1,'0c78a9ffe6b528ee6d5d63b43e076bbd2ef5a02305d36d846bc319f9356da8c0','2026-04-03 10:08:40','2026-03-20 10:08:43','2026-03-20 15:08:39'),(546,1,'f6ddeda319619e4cc2a304891b382bfc338a578489f97d14b6b3c2de6143e530','2026-04-03 10:08:44','2026-03-20 12:43:48','2026-03-20 15:08:43'),(547,1,'c59d6d8ef42fbcc3c45a644d09ab7da3b08c303abeaedff91cc4018fc4d32ab1','2026-04-03 12:43:48','2026-03-20 12:44:31','2026-03-20 17:43:48'),(548,1,'0e846e795957202961ff12630d606eb94c635f990165fd143621332c5f1f1267','2026-04-03 12:44:32','2026-03-20 12:45:37','2026-03-20 17:44:31'),(549,1,'ffb2cc2f780d2b071009902b2aac11c84f40510b0cd66c845b9b12519af2a08d','2026-04-03 12:45:37','2026-03-20 13:44:55','2026-03-20 17:45:37'),(550,1,'d5cdf2036ca3a7711a17f9ae313843f22bd52f0a538ea6859279ddce7ed2ec25','2026-04-03 13:44:56','2026-03-20 13:44:59','2026-03-20 18:44:55'),(551,1,'eed71e38c740f0befee0749c8594e73ed55d117911c7ac944368eca00305af09','2026-04-03 13:44:59','2026-03-20 13:46:25','2026-03-20 18:44:59'),(552,1,'1bff7292476f955c6e8e227e3f873c5cb44fc05f1606b7770979a1bfa39abb53','2026-04-03 13:45:11',NULL,'2026-03-20 18:45:10'),(553,1,'68a784431e1277e81c14b9cd04a97c6d1bace15a90ee8131ccd4ce9cafb79246','2026-04-03 13:46:26','2026-03-20 13:46:29','2026-03-20 18:46:25'),(554,1,'b83478a2ef19692108497a31e7b8fef5efcd980df6363c93184dc4801599fef5','2026-04-03 13:46:29','2026-03-20 13:46:41','2026-03-20 18:46:29'),(555,1,'459a583706923a686a0991378a4727e0842b7c3cf45ac978b51f0a8c2d6cf336','2026-04-03 13:46:41','2026-03-20 13:47:59','2026-03-20 18:46:41'),(556,1,'16d1e2abebce33563dfdf79d59db87b9162934f55db12e2efa35e80cd9be1460','2026-04-03 13:48:00','2026-03-20 13:48:16','2026-03-20 18:47:59'),(557,1,'19a26b9a8cd0355ce4b0f7799576d81c0427a95c3feb057661861deed4786333','2026-04-03 13:48:17','2026-03-20 13:48:23','2026-03-20 18:48:16'),(558,1,'a654f803ad7224119562b14e1dd1590b40ca4b077751a48de0ea54d3d8b94021','2026-04-03 13:48:24','2026-03-20 13:49:33','2026-03-20 18:48:23'),(559,1,'fc5a572228b02783c52a4b9083aac9ce2c13b5e9822343b1f939ae630a9b70c9','2026-04-03 13:49:34','2026-03-20 14:03:56','2026-03-20 18:49:33'),(560,5,'99051fd50229a80b6f6f9bc03873de9b4739eeb736c387399ed6f948590995c6','2026-04-03 13:49:47',NULL,'2026-03-20 18:49:47'),(561,1,'e958cbef8cc5c0b9188b6b45477ba712cf6c6d4ef8cded049e84697fa49715d0','2026-04-03 14:03:57','2026-03-20 14:18:11','2026-03-20 19:03:56'),(562,1,'5efa039ff62d793071707f393806ddca9562eda5f3d8a9231c29eab90a81705f','2026-04-03 14:04:12',NULL,'2026-03-20 19:04:12'),(563,1,'9ce3e36236e3e562964e4148402333b822b19e108415fc1625988bbd2590dbea','2026-04-03 14:18:11','2026-03-20 14:19:15','2026-03-20 19:18:11'),(564,5,'5650b8599bafa65ff9c52dae2da099299d6f2f6d5a010ac125c1ec9c0695f806','2026-04-03 14:18:28',NULL,'2026-03-20 19:18:28'),(565,1,'99be85846b72104559b72b6f8db207f2621f5ef08878294246bf2fa6a2d40e5b','2026-04-03 14:19:16','2026-03-20 14:19:22','2026-03-20 19:19:15'),(566,1,'42433d8bcc599a60e4bfd61dfbfdd323bcf4142e541f98deab4fc1826ac47b1d','2026-04-03 14:19:22','2026-03-20 14:20:30','2026-03-20 19:19:22'),(567,1,'3463f644480e228795cf81502715144dbf56c3f7b437a38e31caab3d2220881c','2026-04-03 14:20:31','2026-03-20 14:42:19','2026-03-20 19:20:30'),(568,1,'27154ffcfef9ea8d8e2dd18ac8c6ce5840caf4509807a957b6cd70c36ef3309e','2026-04-03 14:20:46',NULL,'2026-03-20 19:20:46'),(569,1,'8d7da07802c14ee1469b652e5fa3e1953da23e3aaee6fcae0bf4099381937c8f','2026-04-03 14:42:19','2026-03-20 14:44:30','2026-03-20 19:42:19'),(570,1,'88bcba342bac9ca0d3163f49c40f0ed65f4b398c632a6e028412a026080980ca','2026-04-03 14:44:30','2026-03-20 15:00:59','2026-03-20 19:44:30'),(571,1,'9f4e9bb39b6147f99f57fb4c03893cce4875aa86a6b6064a4d48af3b8d0e8491','2026-04-03 15:01:00','2026-03-20 15:01:19','2026-03-20 20:00:59'),(572,1,'8be0a852469a5c90a9543bc4f58b96a25713a7e3018fe071e991d4f6efea1c69','2026-04-03 15:01:19','2026-03-20 15:01:45','2026-03-20 20:01:19'),(573,1,'a453b3c79afba83c81059b50a2581d4c4ae0c1ab1cf2e769fa41f8f82fbb06fa','2026-04-03 15:01:46','2026-03-20 15:02:16','2026-03-20 20:01:45'),(574,1,'50d29a117e7789da8fc1dad12446f6afed8eb28f8ef34e00b60e20476e1c9917','2026-04-03 15:02:17','2026-03-20 15:02:47','2026-03-20 20:02:16'),(575,1,'0f01f255b0e05295d0ea486ce471a87ad57c5842d4566165f29644e2297ac67d','2026-04-03 15:02:48','2026-03-20 15:02:51','2026-03-20 20:02:47'),(576,1,'1fd73f18e888771dc909aa9f7b12be2da7e8297426cbfff2539720b7ab15c0ad','2026-04-03 15:02:51','2026-03-20 15:05:27','2026-03-20 20:02:51'),(577,1,'a708ca530a6c77e6c5ce40a0cdd094d222c471e8a720e85ee9efd7b618a5aeeb','2026-04-03 15:05:27','2026-03-20 15:05:29','2026-03-20 20:05:27'),(578,1,'76b46ec076a0f475e5aa890aab96ec08a62cd7377176a0ed81e4b71513426e9a','2026-04-03 15:05:29','2026-03-20 16:09:41','2026-03-20 20:05:29'),(579,1,'f48a97fdd69ec18f5f77e4089031208cf366bb54bad7fd6f5091125adcadf9cf','2026-04-03 16:09:41','2026-03-20 16:09:41','2026-03-20 21:09:41'),(580,1,'e699a4e7c8d81cb87d3b21adb58a3c45114cd4c6e446a0141227f39c154fdb77','2026-04-03 16:09:41','2026-03-20 16:09:41','2026-03-20 21:09:41'),(581,1,'ac095e61ad70c7a46f39ca2c76422f90463b30add0f914c31176cae26925b9e5','2026-04-03 16:09:41','2026-03-20 16:09:41','2026-03-20 21:09:41'),(582,1,'188f56646c55898c2e7346cdc5660d18a60ca0299e6102f9df7e97ffc49bd266','2026-04-03 16:09:41','2026-03-20 16:09:41','2026-03-20 21:09:41'),(583,1,'63579efadf96f4e11a25d8e710b7664a38d52b3b5ff79079306a11c4f1245c42','2026-04-03 16:09:42','2026-03-20 16:10:52','2026-03-20 21:09:41'),(584,1,'8012d1f0f93cd00e6c94b0840f706317d6e7be800f664fec4f4926e554e34203','2026-04-03 16:10:52','2026-03-20 16:11:48','2026-03-20 21:10:52'),(585,1,'f2895abc7170136cb722e3954f8f9aae013f4c0a9826cc3b68996addf87089b1','2026-04-03 16:11:48','2026-03-20 16:12:22','2026-03-20 21:11:48'),(586,1,'dec6519e04a1fc0533ca1712dcff251d2de2b23b18cc25014160c509c84c859e','2026-04-03 16:12:23','2026-03-20 16:24:46','2026-03-20 21:12:22'),(587,2,'874bbffb6cc6e601e59fe813f78be624da22df32f35f04ac9411cf009728ff14','2026-04-03 16:13:11',NULL,'2026-03-20 21:13:10'),(588,1,'2ecaab4b93dc026c51cc0b9e2203a4ba5b62f75ff4d6b1ef0e02e103552fee56','2026-04-03 16:24:47',NULL,'2026-03-20 21:24:46'),(589,1,'abcf1767ddba26bb7e67f4e448893860214a201ec0ce1b998baf00f64e733657','2026-04-03 16:24:47','2026-03-20 16:29:40','2026-03-20 21:24:46'),(590,1,'9d9b1d355f6079b387c34bd2215b3e3578defa21aa82d54df49bd6b2b38dd0dc','2026-04-03 16:29:41','2026-03-20 16:32:25','2026-03-20 21:29:40'),(591,1,'7112723120dc1a8db083fc410b532f96935915b5c06d0f1d98d951e00b58d0be','2026-04-03 16:32:26','2026-03-20 16:38:35','2026-03-20 21:32:25'),(592,1,'3c8e24d34143280a3b76b720430d521295e75996bf6773cca7d8c3cffd167543','2026-04-03 16:38:36','2026-03-20 16:45:48','2026-03-20 21:38:35'),(593,1,'2055d1666f63ab778839b7eb7c0a328086c372a554bf14d5b9ae3d9450a4c447','2026-04-03 16:45:48','2026-03-20 16:45:53','2026-03-20 21:45:48'),(594,1,'5787fb1ac93df26828a22c947ffe9f572de60ccc039f68c6ca9aeaf0fd83dd04','2026-04-03 16:45:53','2026-03-20 16:47:30','2026-03-20 21:45:53'),(595,1,'e1612ed33ef02d43ac8517ed65ddf5e6476072dee13bd35a70666f25a84500c6','2026-04-03 16:47:30','2026-03-20 17:01:30','2026-03-20 21:47:30'),(596,1,'6c81c342291a8edd8e365b2cb1b8092bab8216dd2d89dc8c59133d87ed062670','2026-04-03 17:01:30','2026-03-20 18:51:47','2026-03-20 22:01:30'),(597,1,'dc4b31bd562a0d028a9f0da579a778c0b7abb09e5e733ce96f60b0064de37fed','2026-04-03 18:51:47','2026-03-20 18:51:47','2026-03-20 23:51:47'),(598,1,'6c1202e11080cb56aac268b998cf8f9b14c08839ba3a77933054b503e6b1b24f','2026-04-03 18:51:48','2026-03-20 19:06:46','2026-03-20 23:51:47'),(599,1,'b74001bbe0102234a3f4a731bc9c2632d2cd7dcda770e7d101c3f672880339a4','2026-04-03 18:52:42',NULL,'2026-03-20 23:52:41'),(600,1,'5970c4b529a91cb12e1c196fb58be0c769dcf33d085c1e915fcb0645b9be6124','2026-04-03 19:06:47','2026-03-20 19:06:48','2026-03-21 00:06:46'),(601,1,'49fc5f85ec97bc02b3edaa6eb191b5668dcdbe68634b425a619bbaf6a8d75cb5','2026-04-03 19:06:49','2026-03-20 19:07:28','2026-03-21 00:06:48'),(602,2,'96be79d09062f0f3ae1818fbdfa20f46a898e022e784df2a2eca5a42a04daf96','2026-04-03 19:07:21',NULL,'2026-03-21 00:07:21'),(603,1,'bb6ebfc82202ea238d2e4e761e016d6f081052512a2b56981a27a02236ea5a9f','2026-04-03 19:07:29','2026-03-20 19:08:05','2026-03-21 00:07:28'),(604,1,'7da397267c1f5c1e3db38f409e556fb5e7727e0a31a6225fcf9ad8b395c535d5','2026-04-03 19:08:06','2026-03-20 19:08:07','2026-03-21 00:08:05'),(605,1,'b712ac95f6c6bc555e4e1f5ee893613fd289b5457f64f448093eeaf3bcfef20e','2026-04-03 19:08:07','2026-03-20 19:12:04','2026-03-21 00:08:07'),(606,1,'7ed6659c0fd3cb101ffb29392e88576baf4248b41b33a79603764c4d33c12644','2026-04-03 19:12:05','2026-03-20 19:12:08','2026-03-21 00:12:04'),(607,1,'b5d7549de9bdfb777ee4676f54b38776ec84c6ff4613b3c2ba33590d4619a1c7','2026-04-03 19:12:08','2026-03-20 19:15:53','2026-03-21 00:12:08'),(608,2,'73a47968565612447d5d4c292c965f9d417e601b850621164d02de0a285d9da7','2026-04-03 19:12:25',NULL,'2026-03-21 00:12:24'),(609,1,'3754d402f5931e9f658f87f98e430616fcd05288c1f2d293a8961ba5d4106524','2026-04-03 19:15:54','2026-03-20 19:18:58','2026-03-21 00:15:53'),(610,1,'ccba9494c4a843f9e91b97b915f316f70e8cf062c01f1c7fc0230b9492f1c4f6','2026-04-03 19:18:59','2026-03-20 19:18:59','2026-03-21 00:18:58'),(611,1,'ec1ee88a57b2420792579894f2a14eb71552af331f96135de99c99f193a3d972','2026-04-03 19:18:59','2026-03-20 19:19:00','2026-03-21 00:18:59'),(612,1,'49b3bfc99d6dc340d937bab9f31859b2b0e2c7e38e07c0b394e228a940b133b3','2026-04-03 19:19:00','2026-03-20 19:19:00','2026-03-21 00:19:00'),(613,1,'0ec718dc069c62afc0b6f6ffd1861a4b67b205ca2d6009be2e10f75bc437b778','2026-04-03 19:19:00','2026-03-20 19:19:01','2026-03-21 00:19:00'),(614,1,'4006abd148a40609902c44d93d277ae9010251932adb67326a9d3daffebc8aed','2026-04-03 19:19:01','2026-03-20 19:19:01','2026-03-21 00:19:01'),(615,1,'c9b500e9bfca0ac3145afbc9144d4ca2eb92b35394c70f1c4c88411e833e7a72','2026-04-03 19:19:02','2026-03-20 19:19:04','2026-03-21 00:19:01'),(616,1,'e98606d5771ce84da22de8905a305de4648fdc864d30acd4e54f12e98dcaf519','2026-04-03 19:19:05','2026-03-20 19:19:04','2026-03-21 00:19:04'),(617,1,'2457ee914edb60d06eee13863370700454fecc3641b3b58b7b641bdc7103ca8b','2026-04-03 19:19:05','2026-03-20 19:20:18','2026-03-21 00:19:04'),(618,1,'29d253d94e1f6d68a22f3142561cd04820137f1dbed4a0292d40bc08838a41b2','2026-04-03 19:20:19','2026-03-20 19:24:05','2026-03-21 00:20:18'),(619,1,'a59c553bbb968b82fee25e8688a2c9277920136864502a8c096366bc579fa20e','2026-04-03 19:24:06','2026-03-20 19:38:54','2026-03-21 00:24:05'),(620,1,'77815e3ee87c5c3ed004be9765a754e4acabcc24b35e356379a03a5f636d5d00','2026-04-03 19:38:54','2026-03-20 20:12:51','2026-03-21 00:38:54'),(621,1,'237cc94a780d66aefae4b8fb0ebc749f53986af4a47d6a0d7ad588a1d609d5a6','2026-04-03 20:12:52','2026-03-20 20:12:52','2026-03-21 01:12:51'),(622,1,'57a2b41db20c433ab817066dac26cfe34f73b3221b41324e2c16cca0e967f260','2026-04-03 20:12:52','2026-03-20 20:12:52','2026-03-21 01:12:52'),(623,1,'dff864256c7cc9ca555c3ebbed52716a09a604d51c57fd602ccdf58dee0f5cb8','2026-04-03 20:12:52','2026-03-20 20:33:36','2026-03-21 01:12:52'),(624,1,'76267b5e04dd4fab07daa43d8c27b2e9e38839135f4f57d913e77753bbb8a431','2026-04-03 20:33:36','2026-03-20 20:45:19','2026-03-21 01:33:36'),(625,2,'d3c8496542756f1da470dbc5e6482e2f2497bdc04272f343424392950694a130','2026-04-03 20:34:35',NULL,'2026-03-21 01:34:35'),(626,1,'423b5a9e2aafbf4ff231d62c032501a6916801367b8404d598e5403fb5fb42e6','2026-04-03 20:45:19','2026-03-20 20:50:10','2026-03-21 01:45:19'),(627,5,'e43b8df492a6853bf1b5184a85dca332c607db32ff406a8463c3650f2a6a8b7b','2026-04-03 20:45:33',NULL,'2026-03-21 01:45:32'),(628,1,'84abc544048c32cc1f9828f23db388f5444ad246241fe8b41839a7b5757ce769','2026-04-03 20:50:10','2026-03-20 20:51:21','2026-03-21 01:50:10'),(629,1,'1fac43c0990864288c9f3c24c77764d6c0bf5f9dafdbb1082d59f57e0bdad72b','2026-04-03 20:51:22','2026-03-20 20:51:24','2026-03-21 01:51:21'),(630,1,'3b1d5feba8c39f15f0c146d1f1973938c7177802add280f3b5e722cea44de744','2026-04-03 20:51:25','2026-03-20 20:51:28','2026-03-21 01:51:24'),(631,1,'c00ed80e226f5506ac7cbc024e07284efaf491290d3a41761d79505b1d2cd092','2026-04-03 20:51:29','2026-03-20 21:27:55','2026-03-21 01:51:28'),(632,2,'f8026fc7506ec8e3a3a481b64fe71bc6cd6787a1f614d9c87594f70241090e7f','2026-04-03 21:04:59',NULL,'2026-03-21 02:04:59'),(633,1,'7c6e13d4b85a7eb677e2b2c580bd37a1c79fa084a9fd8fb17c40bc21ae45c762','2026-04-03 21:27:55',NULL,'2026-03-21 02:27:55'),(634,1,'aec992094c69ffda1dd23057b2496bae154cc50699f9d3ff36b80e2eeeb45b48','2026-04-03 21:27:55','2026-03-20 21:27:56','2026-03-21 02:27:55'),(635,1,'78ac6bb0b686f99952064b0cc0ad6f2ea06f349958d4cd8f3f63b274fd2513fa','2026-04-03 21:27:57','2026-03-20 21:27:57','2026-03-21 02:27:56'),(636,1,'3a4bddb309972555b529fb152ecd1ed3f9d296a8b0ce8e9ff67c0b50657b84ce','2026-04-03 21:27:57','2026-03-20 22:23:41','2026-03-21 02:27:57'),(637,1,'e223bd30e5675e88a8520a738ebde7ebac9d7e79de2a7b2280f8e780db8640b2','2026-04-03 22:23:42','2026-03-20 22:23:42','2026-03-21 03:23:41'),(638,1,'59363da7260d019d059806d410a9b8a8e7568c02509983e9362a9e7f34995f18','2026-04-03 22:23:43','2026-03-20 22:23:42','2026-03-21 03:23:42'),(639,1,'a9889470d6211a3dfdbe9381e9fe8b318c0e7b1c80cbe8b2ee74fc40a47a4668','2026-04-03 22:23:43','2026-03-20 22:39:10','2026-03-21 03:23:42'),(640,1,'4ad6078a13959eb7ab3520db4dcff2ed246ff8c9805ba07a8f8a2f2991075236','2026-04-03 22:39:10','2026-03-20 22:39:10','2026-03-21 03:39:10'),(641,1,'55f9dbf50f779e3a7848d71d6a2f536acecb2712d15537e9cd03af30541121cf','2026-04-03 22:39:10','2026-03-20 22:39:10','2026-03-21 03:39:10'),(642,1,'37be5e203403d9859e8ddac1c9d70ead844bf3661456bd20211c6d3a86a8304b','2026-04-03 22:39:11','2026-03-20 22:40:31','2026-03-21 03:39:10'),(643,1,'cf198fd65ec65bf2d24182b0226dd906f2cbf44212cda616f5aff7b31d662bb3','2026-04-03 22:40:32','2026-03-20 22:40:45','2026-03-21 03:40:31'),(644,1,'92caee2a59a63cac80f83e791a0f015dd43a5c5a3d31a22e435f22a5156838fe','2026-04-03 22:40:46','2026-03-20 22:45:36','2026-03-21 03:40:45'),(645,1,'d1cd24def0f5c51d22789374686ecb7fbca8a298fa90ba6bc0e40a4e18543ccc','2026-04-03 22:45:37','2026-03-20 22:46:56','2026-03-21 03:45:36'),(646,1,'5c8665db720fd8ee3185f84be59ba80212149ca548351ba4db527bff025fd144','2026-04-03 22:46:57','2026-03-20 22:46:56','2026-03-21 03:46:56'),(647,1,'20b15a835e4ed41291abcb886730ff0583fd1e1af7de1e731861eb9567271aff','2026-04-03 22:46:57','2026-03-20 22:47:00','2026-03-21 03:46:56'),(648,1,'b9333cf23302b2fc616af623bf9800f06e5723e3b27d03a98e4f384dda908c2d','2026-04-03 22:47:00','2026-03-20 22:47:00','2026-03-21 03:47:00'),(649,1,'1a18f9ba004ac4251f41676be1dcaf7d8f42a2c62bcbaa11c2ecef3ef9c9d72e','2026-04-03 22:47:01','2026-03-20 22:47:02','2026-03-21 03:47:00'),(650,1,'186e880ca5915898d2b04f666ec5d6f7d233d20d5d40e182612d35111e26a34d','2026-04-03 22:47:03','2026-03-20 22:47:03','2026-03-21 03:47:02'),(651,1,'3b1c65673eff6af2a16eb441f35f33edf4788e9bdd6c47fe1eee1bb5bc5d17e4','2026-04-03 22:47:03','2026-03-20 22:49:32','2026-03-21 03:47:03'),(652,1,'87f1ab8112202e2e1719ccb221498e1010b1cc938bbc5f79ca2203a5b10fc173','2026-04-03 22:49:33','2026-03-20 22:49:32','2026-03-21 03:49:32'),(653,1,'60518d027dbb55bdff5fd6d8b2a74fe2658b2684ce2706a10558c598e8ee6bba','2026-04-03 22:49:33','2026-03-20 22:49:38','2026-03-21 03:49:32'),(654,1,'57c56f43f11da6cc30a5979145c2fe2480f5613509e7b00446577062e54fbecb','2026-04-03 22:49:38','2026-03-20 22:49:38','2026-03-21 03:49:38'),(655,1,'16f65ec953878286d2bb1f27a15193dd52419ef93a41baa0964d83e87cf69b58','2026-04-03 22:49:38','2026-03-20 23:08:18','2026-03-21 03:49:38'),(656,1,'ad34e582fe875e20c55ee6912449033c9bc941bbddd8b40bd06aacf76c2ad904','2026-04-03 23:08:18','2026-03-20 23:08:18','2026-03-21 04:08:18'),(657,1,'956d4fbbcad3134874f8a2836028cc9f8a5a20ae256d15baba9d1e8b8513631f','2026-04-03 23:08:18','2026-03-20 23:34:22','2026-03-21 04:08:18'),(658,1,'52e7373412a1ef067913ad16f18453bd67aa2f79cd712c48c616c2c2cbe385bc','2026-04-03 23:34:23','2026-03-20 23:34:22','2026-03-21 04:34:22'),(659,1,'56940fc275414b04dc80946c5b2537587b4537ee1a02316b9f6c0d286ad0a35f','2026-04-03 23:34:23','2026-03-20 23:41:13','2026-03-21 04:34:22'),(660,1,'48f80bf11df93f65efeafa1d7fcf320649df29bca2db9ed4b358d77173a4ca86','2026-04-03 23:41:14','2026-03-21 00:54:44','2026-03-21 04:41:13'),(661,1,'ce393e6373df03cda8488403b31186acca69ed274cee0e9697a723b4decf0784','2026-04-04 00:40:27',NULL,'2026-03-21 05:40:27'),(662,1,'d5dfea3d0b2ad8e26f5976c2ca091107022d04cb6126cb7014f8be865ed4ddbc','2026-04-04 00:54:45','2026-03-21 00:58:28','2026-03-21 05:54:44'),(663,1,'0d47c0051cd40aa6199ae6e79022a425f6c9eafd94634037668e0f70e9d3cbd7','2026-04-04 00:58:28','2026-03-21 14:28:01','2026-03-21 05:58:28'),(664,1,'6dc992c34b97aabc190f67a17b7ac92b1044c3df1b06c7a1c4e56e589f332ade','2026-04-04 14:28:01','2026-03-21 14:28:33','2026-03-21 19:28:01'),(665,1,'6b18857162ff8f50f179de2d7eb1ac58f6d6cc2dea4fdfc266d42d164b436e4a','2026-04-04 14:28:17',NULL,'2026-03-21 19:28:17'),(666,1,'32f4f8503be44d555bf182563536a6fe618224957d9fd0dcbb31247e72e816b0','2026-04-04 14:28:34','2026-03-21 16:48:19','2026-03-21 19:28:33'),(667,2,'f111ab1fc47ae26ac55bd5aa8d044d55c8f5ceba871d5cf582b179b0f82c96b9','2026-04-04 14:28:49',NULL,'2026-03-21 19:28:48');
/*!40000 ALTER TABLE `refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_audit_logs`
--

DROP TABLE IF EXISTS `tbl_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `actor_id` bigint unsigned DEFAULT NULL,
  `action` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` bigint unsigned DEFAULT NULL,
  `meta_json` json DEFAULT NULL,
  `ip_address` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tbl_audit_logs_actor` (`actor_id`),
  KEY `idx_tbl_audit_logs_entity` (`entity`,`entity_id`),
  KEY `idx_tbl_audit_logs_action` (`action`),
  KEY `idx_tbl_audit_logs_created_at` (`created_at`),
  CONSTRAINT `fk_tbl_audit_logs_actor` FOREIGN KEY (`actor_id`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=94 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_audit_logs`
--

LOCK TABLES `tbl_audit_logs` WRITE;
/*!40000 ALTER TABLE `tbl_audit_logs` DISABLE KEYS */;
INSERT INTO `tbl_audit_logs` VALUES (1,33,'register_success',NULL,'auth',33,'{\"role\": \"member\", \"email\": \"maru@gmail.com\", \"member_id\": 7, \"member_type\": \"existing\"}','::1','2026-03-23 19:42:09'),(3,NULL,'register_initialized',NULL,'auth',35,'{\"role\": \"member\", \"email\": \"mulat@gmail.com\", \"member_id\": 9, \"member_type\": \"new\", \"membership_status\": \"pending\", \"registration_fee_status\": \"unpaid\"}','::1','2026-03-24 08:49:47'),(4,2,'login_success',NULL,'auth',2,'{\"role\": \"member\", \"member_id\": 2}','::1','2026-03-24 12:06:30'),(5,2,'login_success',NULL,'auth',2,'{\"role\": \"member\", \"member_id\": 2}','::1','2026-03-24 12:07:34'),(6,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-24 12:08:29'),(7,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-24 12:48:10'),(8,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-24 13:12:56'),(9,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-24 13:13:49'),(10,28,'login_success',NULL,'auth',28,'{\"role\": \"finance\", \"member_id\": 1}','::1','2026-03-24 13:14:09'),(11,33,'login_success',NULL,'auth',33,'{\"role\": \"member\", \"member_id\": 7}','::1','2026-03-24 13:15:20'),(12,2,'login_success',NULL,'auth',2,'{\"role\": \"member\", \"member_id\": 2}','::1','2026-03-24 13:17:38'),(13,3,'login_success',NULL,'auth',3,'{\"role\": \"member\", \"member_id\": 3}','::1','2026-03-24 13:18:44'),(14,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-24 13:19:25'),(15,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-24 13:30:10'),(16,33,'login_success',NULL,'auth',33,'{\"role\": \"member\", \"member_id\": 7}','::1','2026-03-24 13:30:29'),(17,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-24 13:51:18'),(18,28,'login_success',NULL,'auth',28,'{\"role\": \"finance\", \"member_id\": 1}','::1','2026-03-24 13:54:22'),(19,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-24 14:07:11'),(20,33,'login_success',NULL,'auth',33,'{\"role\": \"member\", \"member_id\": 7}','::1','2026-03-24 14:08:17'),(21,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-24 14:23:50'),(22,28,'login_success',NULL,'auth',28,'{\"role\": \"finance\", \"member_id\": 1}','::1','2026-03-24 14:24:38'),(23,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-24 14:25:33'),(24,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-24 14:39:50'),(25,2,'login_success',NULL,'auth',2,'{\"role\": \"member\", \"member_id\": 2}','::1','2026-03-24 14:40:21'),(26,NULL,'member_register_new',NULL,'member',10,'{\"email\": \"beti@gmail.com\", \"member_type\": \"new\", \"registration_fee_status\": \"unpaid\"}','::1','2026-03-24 14:41:27'),(27,NULL,'login_success',NULL,'auth',36,'{\"role\": \"member\", \"member_id\": 10}','::1','2026-03-24 14:43:06'),(28,28,'login_success',NULL,'auth',28,'{\"role\": \"finance\", \"member_id\": 1}','::1','2026-03-24 14:59:17'),(29,2,'login_success',NULL,'auth',2,'{\"role\": \"member\", \"member_id\": 2}','::1','2026-03-24 14:59:57'),(30,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-24 15:00:37'),(31,28,'login_success',NULL,'auth',28,'{\"role\": \"finance\", \"member_id\": 1}','::1','2026-03-24 15:01:16'),(32,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-24 15:02:09'),(33,28,'login_success',NULL,'auth',28,'{\"role\": \"finance\", \"member_id\": 1}','::1','2026-03-24 15:04:13'),(34,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-24 15:23:34'),(35,28,'login_success',NULL,'auth',28,'{\"role\": \"finance\", \"member_id\": 1}','::1','2026-03-24 15:23:56'),(36,2,'login_success',NULL,'auth',2,'{\"role\": \"member\", \"member_id\": 2}','::1','2026-03-24 15:28:09'),(37,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-24 15:49:28'),(38,28,'login_success',NULL,'auth',28,'{\"role\": \"finance\", \"member_id\": 1}','::1','2026-03-24 15:55:28'),(39,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-24 15:56:39'),(40,2,'login_success',NULL,'auth',2,'{\"role\": \"member\", \"member_id\": 2}','::1','2026-03-24 16:27:34'),(41,28,'login_success',NULL,'auth',28,'{\"role\": \"finance\", \"member_id\": 1}','::1','2026-03-24 16:28:10'),(42,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-24 16:51:56'),(43,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-24 16:52:15'),(44,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-24 18:08:22'),(45,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-24 19:16:45'),(46,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-24 19:17:23'),(47,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-24 19:19:21'),(48,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-24 20:41:26'),(49,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-24 20:42:17'),(50,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-24 20:43:09'),(51,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-24 21:11:39'),(52,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-24 21:12:11'),(53,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-25 15:57:09'),(54,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-25 18:12:07'),(55,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-25 18:36:02'),(56,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-26 06:19:58'),(57,37,'member_register_new',NULL,'member',11,'{\"email\": \"melaku@gmail.com\", \"member_type\": \"new\", \"registration_fee_status\": \"unpaid\"}','::1','2026-03-26 06:37:45'),(58,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-26 06:48:06'),(59,38,'member_register_new',NULL,'member',12,'{\"email\": \"meseret@gmail.com\", \"member_type\": \"new\", \"registration_fee_status\": \"unpaid\"}','::1','2026-03-26 07:02:37'),(60,39,'member_register_new',NULL,'member',13,'{\"email\": \"hawa@gmail.com\", \"member_type\": \"new\", \"registration_fee_status\": \"unpaid\"}','::1','2026-03-26 16:29:24'),(61,40,'member_register_new',NULL,'member',14,'{\"email\": \"mat@gmail.com\", \"member_type\": \"new\", \"registration_fee_status\": \"unpaid\"}','::1','2026-03-26 17:12:53'),(62,41,'member_register_new',NULL,'member',15,'{\"email\": \"mek@gmail.com\", \"member_type\": \"new\", \"registration_fee_status\": \"unpaid\"}','::1','2026-03-26 17:38:16'),(63,42,'member_register_new',NULL,'member',16,'{\"email\": \"meba@gmail.com\", \"member_type\": \"new\", \"registration_fee_status\": \"unpaid\"}','::1','2026-03-26 20:40:18'),(64,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-27 08:15:59'),(65,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-27 13:18:36'),(66,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}','::1','2026-03-27 14:25:47'),(67,28,'login_success',NULL,'auth',28,'{\"role\": \"finance\", \"member_id\": 1}','::1','2026-03-27 15:17:22'),(68,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-27 17:00:43'),(69,43,'member_register_new',NULL,'member',17,'{\"email\": \"mamo@gmail.com\", \"member_type\": \"new\", \"registration_fee_status\": \"unpaid\"}','::1','2026-03-27 18:48:46'),(70,44,'member_register_new',NULL,'member',18,'{\"email\": \"nat111@gmail.com\", \"member_type\": \"new\", \"registration_fee_status\": \"unpaid\"}','::1','2026-03-27 18:56:46'),(71,28,'login_success',NULL,'auth',28,'{\"role\": \"finance\", \"member_id\": 1}','::1','2026-03-27 19:10:45'),(72,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-27 22:25:55'),(73,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-28 00:50:30'),(74,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-28 09:44:54'),(75,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-28 10:10:40'),(76,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}','::1','2026-03-28 10:22:21'),(77,29,'admin_member_deleted',NULL,'member',10,'{}','::1','2026-03-28 10:43:02'),(78,29,'admin_member_deleted',NULL,'member',10,'{}','::1','2026-03-28 10:43:15'),(79,29,'admin_member_deleted',NULL,'member',9,'{}','::1','2026-03-28 10:43:51'),(80,29,'system_settings_updated',NULL,'system_settings',NULL,'{\"sections\": [\"general\", \"branding\", \"access\", \"membership\", \"finance\", \"notifications\", \"integrations\", \"maintenance\"]}','::1','2026-03-28 11:16:39'),(81,29,'system_settings_updated',NULL,'system_settings',NULL,'{\"sections\": [\"general\", \"branding\", \"access\", \"membership\", \"finance\", \"notifications\", \"integrations\", \"maintenance\"]}','::1','2026-03-28 11:20:22'),(82,29,'system_settings_updated',NULL,'system_settings',NULL,'{\"sections\": [\"general\", \"branding\", \"access\", \"membership\", \"finance\", \"notifications\", \"integrations\", \"maintenance\"]}','::1','2026-03-28 11:20:44'),(83,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}',NULL,'2026-03-28 12:39:11'),(84,1,'login_success',NULL,'auth',1,'{\"role\": \"member\", \"member_id\": 1}',NULL,'2026-03-28 13:27:35'),(85,29,'login_success',NULL,'auth',29,'{\"role\": \"admin\", \"member_id\": 1}',NULL,'2026-03-28 13:29:10'),(86,29,'system_settings_updated',NULL,'system_settings',NULL,'{\"sections\": [\"general\", \"branding\", \"access\", \"membership\", \"finance\", \"notifications\", \"integrations\", \"maintenance\"]}','::1','2026-03-28 14:57:54'),(87,29,'system_settings_updated',NULL,'system_settings',NULL,'{\"sections\": [\"general\", \"branding\", \"access\", \"membership\", \"finance\", \"notifications\", \"integrations\", \"maintenance\"]}','::1','2026-03-28 14:59:55'),(88,29,'system_settings_updated',NULL,'system_settings',NULL,'{\"sections\": [\"general\", \"branding\", \"access\", \"membership\", \"finance\", \"notifications\", \"integrations\", \"maintenance\"]}','::1','2026-03-28 15:23:17'),(89,29,'system_settings_updated',NULL,'system_settings',NULL,'{\"sections\": [\"general\", \"branding\", \"access\", \"membership\", \"finance\", \"notifications\", \"integrations\", \"maintenance\"]}','::1','2026-03-28 15:24:06'),(90,29,'system_settings_updated',NULL,'system_settings',NULL,'{\"sections\": [\"general\", \"branding\", \"access\", \"membership\", \"finance\", \"notifications\", \"integrations\", \"maintenance\"]}','::1','2026-03-28 15:26:12'),(91,29,'system_settings_updated',NULL,'system_settings',NULL,'{\"sections\": [\"general\", \"branding\", \"access\", \"membership\", \"finance\", \"notifications\", \"integrations\", \"maintenance\"]}','::1','2026-03-28 15:26:16'),(92,29,'system_settings_updated',NULL,'system_settings',NULL,'{\"sections\": [\"general\", \"branding\", \"access\", \"membership\", \"finance\", \"notifications\", \"integrations\", \"maintenance\"]}','::1','2026-03-28 15:34:30'),(93,45,'member_register_new',NULL,'member',20,'{\"email\": \"buta@gmail.com\", \"member_type\": \"new\", \"registration_fee_status\": \"unpaid\"}',NULL,'2026-03-28 17:07:29');
/*!40000 ALTER TABLE `tbl_audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_dashboard_themes`
--

DROP TABLE IF EXISTS `tbl_dashboard_themes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_dashboard_themes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `theme_key` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `theme_name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `page_bg` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#edf3fb',
  `surface_bg` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#ffffff',
  `border_color` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#d7e3f3',
  `text_color` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#15263f',
  `muted_text_color` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#687995',
  `desktop_text_color` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#0f172a',
  `sidebar_bg` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#0f1d34',
  `sidebar_text_color` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#eef4ff',
  `header_bg` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#0f1e36',
  `header_text_color` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#ffffff',
  `active_nav_bg` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#3a6de8',
  `active_nav_text_color` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#ffffff',
  `button_bg` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#315bcb',
  `button_text` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#ffffff',
  `highlight_bg` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#eef4ff',
  `highlight_text` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#315bcb',
  `shadow_color` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#0f172a',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_default` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dashboard_themes_theme_key` (`theme_key`),
  KEY `idx_dashboard_themes_role_name` (`role_name`),
  KEY `idx_dashboard_themes_is_active` (`is_active`),
  KEY `idx_dashboard_themes_is_default` (`is_default`),
  KEY `idx_role_active` (`role_name`,`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_dashboard_themes`
--

LOCK TABLES `tbl_dashboard_themes` WRITE;
/*!40000 ALTER TABLE `tbl_dashboard_themes` DISABLE KEYS */;
INSERT INTO `tbl_dashboard_themes` VALUES (1,'admin_default','admin','Admin Default','#edf3fb','#ffffff','#d7e3f3','#15263f','#687995','#15263f','#1c3459','#eef4ff','#1a3a6b','#ffffff','#3a6de8','#ffffff','#315bcb','#ffffff','#eef4ff','#315bcb','#0f172a',1,1,'2026-03-20 10:14:35','2026-03-28 15:27:04'),(2,'finance_default','finance','Finance Default','#edf6f2','#ffffff','#d7e3f3','#19372f','#6b847d','#0f172a','#0f2d28','#effbf5','#0f2c28','#ffffff','#1ca56c','#ffffff','#1ca56c','#ffffff','#e9f8f0','#1ca56c','#0f172a',1,1,'2026-03-20 10:14:35','2026-03-20 10:14:35'),(3,'member_default','member','Member Default','#f2eef9','#ffffff','#d7e3f3','#a61120','#687995','#0f172a','#a61120','#faf5ff','#a61120','#ffffff','#a61120','#ffffff','#05704c','#ffffff','#f3ecff','#160bb1','#19419f',0,1,'2026-03-20 10:14:35','2026-03-22 20:05:49'),(6,'member','member','member','#edf3fb','#ffffff','#d7e3f3','#15263f','#687995','#0f172a','#335b3a','#eef4ff','#335b3a','#ffffff','#335b3a','#ffffff','#335b3a','#ffffff','#eef4ff','#315bcb','#145b5d',1,0,'2026-03-20 15:05:11','2026-03-22 20:05:49');
/*!40000 ALTER TABLE `tbl_dashboard_themes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_expenses`
--

DROP TABLE IF EXISTS `tbl_expenses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_expenses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `expense_number` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vendor_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `expense_date` date NOT NULL,
  `payment_method` enum('cash','card','check','ach','zelle','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'other',
  `status` enum('draft','approved','paid','voided') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'approved',
  `created_by` bigint unsigned DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_expenses_expense_number` (`expense_number`),
  KEY `idx_tbl_expenses_date` (`expense_date`),
  KEY `idx_tbl_expenses_status` (`status`),
  KEY `idx_tbl_expenses_created_by` (`created_by`),
  KEY `idx_tbl_expenses_approved_by` (`approved_by`),
  CONSTRAINT `fk_tbl_expenses_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_expenses_created_by` FOREIGN KEY (`created_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_expenses`
--

LOCK TABLES `tbl_expenses` WRITE;
/*!40000 ALTER TABLE `tbl_expenses` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_expenses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_cash_batches`
--

DROP TABLE IF EXISTS `tbl_finance_cash_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_cash_batches` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `category` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general_collection',
  `service_date` date NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` bigint unsigned NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cash_batches_service_date` (`service_date`),
  KEY `idx_cash_batches_created_by` (`created_by`),
  KEY `idx_cash_batches_category` (`category`),
  CONSTRAINT `fk_cash_batches_created_by` FOREIGN KEY (`created_by`) REFERENCES `tbl_users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_cash_batches`
--

LOCK TABLES `tbl_finance_cash_batches` WRITE;
/*!40000 ALTER TABLE `tbl_finance_cash_batches` DISABLE KEYS */;
INSERT INTO `tbl_finance_cash_batches` VALUES (1,'sunday_offering','2026-03-23',500.00,'thanks',28,'2026-03-23 12:12:55'),(2,'sunday_offering','2026-03-26',600.00,NULL,28,'2026-03-27 19:15:31');
/*!40000 ALTER TABLE `tbl_finance_cash_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_cash_entries`
--

DROP TABLE IF EXISTS `tbl_finance_cash_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_cash_entries` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `member_id` bigint unsigned DEFAULT NULL,
  `payment_id` bigint unsigned DEFAULT NULL,
  `full_name_snapshot` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_snapshot` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_no` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `received_date` datetime NOT NULL,
  `received_by` bigint unsigned DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `status` enum('received','approved','posted','voided') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'received',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tbl_finance_cash_entries_member` (`member_id`),
  KEY `idx_tbl_finance_cash_entries_payment` (`payment_id`),
  KEY `idx_tbl_finance_cash_entries_status` (`status`),
  KEY `idx_tbl_finance_cash_entries_amount` (`amount`),
  KEY `idx_tbl_finance_cash_entries_received_date` (`received_date`),
  KEY `idx_tbl_finance_cash_entries_received_by` (`received_by`),
  KEY `idx_tbl_finance_cash_entries_approved_by` (`approved_by`),
  KEY `idx_tbl_finance_cash_entries_created_by` (`created_by`),
  CONSTRAINT `fk_tbl_finance_cash_entries_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_cash_entries_created_by` FOREIGN KEY (`created_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_cash_entries_member` FOREIGN KEY (`member_id`) REFERENCES `tbl_members` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_cash_entries_payment` FOREIGN KEY (`payment_id`) REFERENCES `tbl_finance_payments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_cash_entries_received_by` FOREIGN KEY (`received_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_cash_entries`
--

LOCK TABLES `tbl_finance_cash_entries` WRITE;
/*!40000 ALTER TABLE `tbl_finance_cash_entries` DISABLE KEYS */;
INSERT INTO `tbl_finance_cash_entries` VALUES (1,NULL,NULL,NULL,NULL,NULL,200.00,'2026-03-23 08:28:00',28,NULL,28,'received','we received 200 cash','2026-03-23 08:28:33'),(2,NULL,NULL,'nigusea',NULL,NULL,300.00,'2026-03-23 19:00:00',28,NULL,28,'received','300 cash','2026-03-23 09:14:01'),(3,NULL,NULL,'alem alem',NULL,'for shama',200.00,'2026-03-22 19:00:00',28,NULL,28,'received','thanks','2026-03-23 11:21:06'),(4,NULL,NULL,'meba',NULL,'goog',50.00,'2026-03-22 19:00:00',28,NULL,28,'received','received','2026-03-23 11:43:16');
/*!40000 ALTER TABLE `tbl_finance_cash_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_check_entries`
--

DROP TABLE IF EXISTS `tbl_finance_check_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_check_entries` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `member_id` bigint unsigned DEFAULT NULL,
  `payment_id` bigint unsigned DEFAULT NULL,
  `full_name_snapshot` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_snapshot` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `check_number` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bank_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `received_date` datetime DEFAULT NULL,
  `deposited_date` datetime DEFAULT NULL,
  `received_by` bigint unsigned DEFAULT NULL,
  `deposited_by` bigint unsigned DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `status` enum('received','deposited','cleared','returned','voided') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'received',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tbl_finance_check_entries_member` (`member_id`),
  KEY `idx_tbl_finance_check_entries_payment` (`payment_id`),
  KEY `idx_tbl_finance_check_entries_status` (`status`),
  KEY `idx_tbl_finance_check_entries_amount` (`amount`),
  KEY `idx_tbl_finance_check_entries_received_date` (`received_date`),
  KEY `idx_tbl_finance_check_entries_received_by` (`received_by`),
  KEY `idx_tbl_finance_check_entries_deposited_by` (`deposited_by`),
  KEY `idx_tbl_finance_check_entries_created_by` (`created_by`),
  CONSTRAINT `fk_tbl_finance_check_entries_created_by` FOREIGN KEY (`created_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_check_entries_deposited_by` FOREIGN KEY (`deposited_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_check_entries_member` FOREIGN KEY (`member_id`) REFERENCES `tbl_members` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_check_entries_payment` FOREIGN KEY (`payment_id`) REFERENCES `tbl_finance_payments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_check_entries_received_by` FOREIGN KEY (`received_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_check_entries`
--

LOCK TABLES `tbl_finance_check_entries` WRITE;
/*!40000 ALTER TABLE `tbl_finance_check_entries` DISABLE KEYS */;
INSERT INTO `tbl_finance_check_entries` VALUES (1,NULL,NULL,'abebe dala',NULL,'64e547778',NULL,400.00,'2026-03-25 19:00:00','2026-03-27 19:14:12',28,28,28,'deposited','check','2026-03-27 19:13:25');
/*!40000 ALTER TABLE `tbl_finance_check_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_dues_plans`
--

DROP TABLE IF EXISTS `tbl_finance_dues_plans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_dues_plans` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `plan_code` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plan_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `amount` decimal(12,2) NOT NULL,
  `registration_fee` decimal(12,2) NOT NULL DEFAULT '50.00',
  `member_type` enum('both','existing','new') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'both',
  `sort_order` int NOT NULL DEFAULT '0',
  `allow_custom_amount` tinyint(1) NOT NULL DEFAULT '0',
  `billing_cycle` enum('weekly','monthly','quarterly','half-yearly','yearly','custom') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'monthly',
  `duration_months` int DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_finance_dues_plans_plan_code` (`plan_code`),
  KEY `idx_tbl_finance_dues_plans_active_sort` (`is_active`,`sort_order`,`id`),
  KEY `idx_tbl_finance_dues_plans_cycle` (`billing_cycle`),
  KEY `idx_tbl_finance_dues_plans_member_type` (`member_type`),
  KEY `idx_tbl_finance_dues_plans_duration` (`duration_months`),
  KEY `idx_tbl_finance_dues_plans_created_by` (`created_by`),
  CONSTRAINT `fk_tbl_finance_dues_plans_created_by` FOREIGN KEY (`created_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_dues_plans`
--

LOCK TABLES `tbl_finance_dues_plans` WRITE;
/*!40000 ALTER TABLE `tbl_finance_dues_plans` DISABLE KEYS */;
INSERT INTO `tbl_finance_dues_plans` VALUES (1,'01','Membership',NULL,150.00,60.00,'both',1,1,'monthly',1,1,29,'2026-03-24 19:18:12','2026-03-28 01:44:44');
/*!40000 ALTER TABLE `tbl_finance_dues_plans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_dues_subscriptions`
--

DROP TABLE IF EXISTS `tbl_finance_dues_subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_dues_subscriptions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `member_id` bigint unsigned NOT NULL,
  `dues_plan_id` bigint unsigned NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `auto_renew` tinyint(1) NOT NULL DEFAULT '0',
  `auto_payment_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('active','paused','ended','canceled') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `stripe_customer_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_subscription_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_price_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `current_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `interval_unit` enum('day','week','month','year') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'month',
  `interval_count` int NOT NULL DEFAULT '1',
  `next_plan_id` bigint unsigned DEFAULT NULL,
  `change_effective_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dues_subscriptions_stripe_subscription_id` (`stripe_subscription_id`),
  KEY `idx_tbl_finance_dues_subscriptions_member` (`member_id`),
  KEY `idx_tbl_finance_dues_subscriptions_plan` (`dues_plan_id`),
  KEY `idx_tbl_finance_dues_subscriptions_next_plan` (`next_plan_id`),
  KEY `idx_tbl_finance_dues_subscriptions_status` (`status`),
  KEY `idx_tbl_finance_dues_subscriptions_auto` (`auto_payment_enabled`,`auto_renew`),
  KEY `idx_tbl_finance_dues_subscriptions_member_status` (`member_id`,`status`),
  KEY `idx_tbl_finance_dues_subscriptions_dates` (`start_date`,`end_date`),
  KEY `idx_tbl_finance_dues_subscriptions_created_by` (`created_by`),
  CONSTRAINT `fk_tbl_finance_dues_subscriptions_created_by` FOREIGN KEY (`created_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_dues_subscriptions_member` FOREIGN KEY (`member_id`) REFERENCES `tbl_members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tbl_finance_dues_subscriptions_next_plan` FOREIGN KEY (`next_plan_id`) REFERENCES `tbl_finance_dues_plans` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_dues_subscriptions_plan` FOREIGN KEY (`dues_plan_id`) REFERENCES `tbl_finance_dues_plans` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_dues_subscriptions`
--

LOCK TABLES `tbl_finance_dues_subscriptions` WRITE;
/*!40000 ALTER TABLE `tbl_finance_dues_subscriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_finance_dues_subscriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_invoice_items`
--

DROP TABLE IF EXISTS `tbl_finance_invoice_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_invoice_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_id` bigint unsigned NOT NULL,
  `item_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` decimal(10,2) NOT NULL DEFAULT '1.00',
  `unit_price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `line_total` decimal(12,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tbl_finance_invoice_items_invoice` (`invoice_id`),
  KEY `idx_tbl_finance_invoice_items_code` (`item_code`),
  CONSTRAINT `fk_tbl_finance_invoice_items_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `tbl_finance_invoices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_invoice_items`
--

LOCK TABLES `tbl_finance_invoice_items` WRITE;
/*!40000 ALTER TABLE `tbl_finance_invoice_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_finance_invoice_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_invoices`
--

DROP TABLE IF EXISTS `tbl_finance_invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_invoices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `invoice_number` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `member_id` bigint unsigned NOT NULL,
  `dues_subscription_id` bigint unsigned DEFAULT NULL,
  `invoice_type` enum('registration_fee','membership_dues','donation','manual','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'membership_dues',
  `period_label` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `period_start` date DEFAULT NULL,
  `period_end` date DEFAULT NULL,
  `issue_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT '0.00',
  `tax_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `paid_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `balance_due` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` enum('draft','issued','partially_paid','paid','voided','overdue') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'issued',
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` bigint unsigned DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_finance_invoices_invoice_number` (`invoice_number`),
  KEY `idx_tbl_finance_invoices_member` (`member_id`),
  KEY `idx_tbl_finance_invoices_subscription` (`dues_subscription_id`),
  KEY `idx_tbl_finance_invoices_status` (`status`),
  KEY `idx_tbl_finance_invoices_issue_date` (`issue_date`),
  KEY `idx_tbl_finance_invoices_due_date` (`due_date`),
  KEY `idx_tbl_finance_invoices_member_status` (`member_id`,`status`),
  KEY `idx_tbl_finance_invoices_member_due` (`member_id`,`due_date`),
  KEY `idx_tbl_finance_invoices_created_by` (`created_by`),
  KEY `idx_tbl_finance_invoices_approved_by` (`approved_by`),
  CONSTRAINT `fk_tbl_finance_invoices_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_invoices_created_by` FOREIGN KEY (`created_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_invoices_member` FOREIGN KEY (`member_id`) REFERENCES `tbl_members` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tbl_finance_invoices_subscription` FOREIGN KEY (`dues_subscription_id`) REFERENCES `tbl_finance_dues_subscriptions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_invoices`
--

LOCK TABLES `tbl_finance_invoices` WRITE;
/*!40000 ALTER TABLE `tbl_finance_invoices` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_finance_invoices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_manual_entries`
--

DROP TABLE IF EXISTS `tbl_finance_manual_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_manual_entries` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `member_id` bigint unsigned DEFAULT NULL,
  `entry_number` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entry_type` enum('debit','credit','adjustment','opening_balance') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'adjustment',
  `payment_method` enum('cash','check','zelle','ach','card','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'cash',
  `amount` decimal(12,2) NOT NULL,
  `reference_no` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entry_date` datetime NOT NULL,
  `full_name_snapshot` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_snapshot` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('draft','posted','voided') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'posted',
  `created_by` bigint unsigned DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tbl_finance_manual_entries_member` (`member_id`),
  KEY `idx_tbl_finance_manual_entries_date` (`entry_date`),
  KEY `idx_tbl_finance_manual_entries_status` (`status`),
  KEY `idx_tbl_finance_manual_entries_method` (`payment_method`),
  KEY `idx_tbl_finance_manual_entries_amount` (`amount`),
  KEY `idx_tbl_finance_manual_entries_created_by` (`created_by`),
  KEY `idx_tbl_finance_manual_entries_updated_by` (`updated_by`),
  KEY `idx_tbl_finance_manual_entries_approved_by` (`approved_by`),
  CONSTRAINT `fk_tbl_finance_manual_entries_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_manual_entries_created_by` FOREIGN KEY (`created_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_manual_entries_member` FOREIGN KEY (`member_id`) REFERENCES `tbl_members` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_manual_entries_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_manual_entries`
--

LOCK TABLES `tbl_finance_manual_entries` WRITE;
/*!40000 ALTER TABLE `tbl_finance_manual_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_finance_manual_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_member_ledger`
--

DROP TABLE IF EXISTS `tbl_finance_member_ledger`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_member_ledger` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ledger_uuid` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `member_id` bigint unsigned NOT NULL,
  `member_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name_snapshot` varchar(180) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_snapshot` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `record_type` enum('invoice','payment','manual_entry','adjustment','credit_memo','debit_memo','refund','writeoff','opening_balance') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `related_document_type` enum('invoice','payment','receipt','manual_entry','check_entry','zelle_entry','cash_entry','dues_subscription','reconciliation','system') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system',
  `related_document_id` bigint unsigned DEFAULT NULL,
  `related_document_number` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `record_date` datetime NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `debit_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `credit_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `running_balance` decimal(12,2) NOT NULL DEFAULT '0.00',
  `source` enum('invoice','payment','manual_entry','check','zelle','cash','ach','card','system','migration') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'system',
  `source_reference` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','posted','approved','voided','reversed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'posted',
  `created_by` bigint unsigned DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `voided_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_finance_member_ledger_uuid` (`ledger_uuid`),
  KEY `idx_tbl_finance_member_ledger_member_date` (`member_id`,`record_date`),
  KEY `idx_tbl_finance_member_ledger_record_type` (`record_type`,`record_date`),
  KEY `idx_tbl_finance_member_ledger_related` (`related_document_type`,`related_document_id`),
  KEY `idx_tbl_finance_member_ledger_status` (`status`),
  KEY `idx_tbl_finance_member_ledger_source` (`source`),
  KEY `idx_tbl_finance_member_ledger_created_by` (`created_by`),
  KEY `idx_tbl_finance_member_ledger_amount` (`amount`),
  KEY `idx_tbl_finance_member_ledger_full_name` (`full_name_snapshot`),
  KEY `idx_tbl_finance_member_ledger_phone` (`phone_snapshot`),
  KEY `idx_tbl_finance_member_ledger_member_balance` (`member_id`,`id`),
  KEY `idx_tbl_finance_member_ledger_approved_by` (`approved_by`),
  CONSTRAINT `fk_tbl_finance_member_ledger_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_member_ledger_created_by` FOREIGN KEY (`created_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_member_ledger_member` FOREIGN KEY (`member_id`) REFERENCES `tbl_members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_member_ledger`
--

LOCK TABLES `tbl_finance_member_ledger` WRITE;
/*!40000 ALTER TABLE `tbl_finance_member_ledger` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_finance_member_ledger` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_payments`
--

DROP TABLE IF EXISTS `tbl_finance_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_payments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `payment_number` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `member_id` bigint unsigned DEFAULT NULL,
  `full_name_snapshot` varchar(180) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_snapshot` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `related_invoice_id` bigint unsigned DEFAULT NULL,
  `dues_subscription_id` bigint unsigned DEFAULT NULL,
  `payment_type` enum('registration_fee','membership_dues','donation','invoice_payment','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'invoice_payment',
  `method` enum('card','ach','cash','check','zelle') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'card',
  `provider` enum('stripe','manual','bank','zelle') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manual',
  `amount` decimal(12,2) NOT NULL,
  `currency` char(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USD',
  `description` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_no` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending','approved','paid','failed','refunded','canceled','voided') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `stripe_event_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_payment_intent_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_charge_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_checkout_session_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_invoice_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `stripe_subscription_id` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_finance_payments_payment_number` (`payment_number`),
  UNIQUE KEY `uq_tbl_finance_payments_stripe_event_id` (`stripe_event_id`),
  UNIQUE KEY `uq_tbl_finance_payments_payment_intent` (`stripe_payment_intent_id`),
  KEY `idx_tbl_finance_payments_member` (`member_id`),
  KEY `idx_tbl_finance_payments_invoice` (`related_invoice_id`),
  KEY `idx_tbl_finance_payments_subscription` (`dues_subscription_id`),
  KEY `idx_tbl_finance_payments_status` (`status`),
  KEY `idx_tbl_finance_payments_paid_at` (`paid_at`),
  KEY `idx_tbl_finance_payments_method` (`method`),
  KEY `idx_tbl_finance_payments_provider` (`provider`),
  KEY `idx_tbl_finance_payments_type` (`payment_type`),
  KEY `idx_tbl_finance_payments_member_paid_at` (`member_id`,`paid_at`),
  KEY `idx_tbl_finance_payments_checkout_session` (`stripe_checkout_session_id`),
  KEY `idx_tbl_finance_payments_stripe_subscription` (`stripe_subscription_id`),
  KEY `idx_tbl_finance_payments_created_by` (`created_by`),
  KEY `idx_tbl_finance_payments_approved_by` (`approved_by`),
  CONSTRAINT `fk_tbl_finance_payments_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_payments_created_by` FOREIGN KEY (`created_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_payments_invoice` FOREIGN KEY (`related_invoice_id`) REFERENCES `tbl_finance_invoices` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_payments_member` FOREIGN KEY (`member_id`) REFERENCES `tbl_members` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_payments_subscription` FOREIGN KEY (`dues_subscription_id`) REFERENCES `tbl_finance_dues_subscriptions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_payments`
--

LOCK TABLES `tbl_finance_payments` WRITE;
/*!40000 ALTER TABLE `tbl_finance_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_finance_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_receipts`
--

DROP TABLE IF EXISTS `tbl_finance_receipts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_receipts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `receipt_number` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `member_id` bigint unsigned DEFAULT NULL,
  `payment_id` bigint unsigned DEFAULT NULL,
  `invoice_id` bigint unsigned DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `issued_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `emailed_at` datetime DEFAULT NULL,
  `email_to` varchar(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email_status` enum('pending','sent','failed','skipped') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `issued_by` bigint unsigned DEFAULT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_finance_receipts_receipt_number` (`receipt_number`),
  KEY `idx_tbl_finance_receipts_member` (`member_id`),
  KEY `idx_tbl_finance_receipts_payment` (`payment_id`),
  KEY `idx_tbl_finance_receipts_invoice` (`invoice_id`),
  KEY `idx_tbl_finance_receipts_issued_at` (`issued_at`),
  KEY `idx_tbl_finance_receipts_email_status` (`email_status`),
  KEY `idx_tbl_finance_receipts_issued_by` (`issued_by`),
  CONSTRAINT `fk_tbl_finance_receipts_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `tbl_finance_invoices` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_receipts_issued_by` FOREIGN KEY (`issued_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_receipts_member` FOREIGN KEY (`member_id`) REFERENCES `tbl_members` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_receipts_payment` FOREIGN KEY (`payment_id`) REFERENCES `tbl_finance_payments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_receipts`
--

LOCK TABLES `tbl_finance_receipts` WRITE;
/*!40000 ALTER TABLE `tbl_finance_receipts` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_finance_receipts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_reconciliation_items`
--

DROP TABLE IF EXISTS `tbl_finance_reconciliation_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_reconciliation_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `reconciliation_id` bigint unsigned NOT NULL,
  `source_table` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_id` bigint unsigned NOT NULL,
  `source_reference` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `system_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `bank_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `difference_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` enum('matched','unmatched','adjusted') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unmatched',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tbl_finance_reconciliation_items_reconciliation` (`reconciliation_id`),
  KEY `idx_tbl_finance_reconciliation_items_status` (`status`),
  CONSTRAINT `fk_tbl_finance_reconciliation_items_reconciliation` FOREIGN KEY (`reconciliation_id`) REFERENCES `tbl_finance_reconciliations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_reconciliation_items`
--

LOCK TABLES `tbl_finance_reconciliation_items` WRITE;
/*!40000 ALTER TABLE `tbl_finance_reconciliation_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_finance_reconciliation_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_reconciliations`
--

DROP TABLE IF EXISTS `tbl_finance_reconciliations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_reconciliations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `reconciliation_number` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `status` enum('draft','in_progress','completed','approved') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `total_system_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_bank_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_difference` decimal(12,2) NOT NULL DEFAULT '0.00',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` bigint unsigned DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_finance_reconciliations_number` (`reconciliation_number`),
  KEY `idx_tbl_finance_reconciliations_status` (`status`),
  KEY `idx_tbl_finance_reconciliations_created_by` (`created_by`),
  KEY `idx_tbl_finance_reconciliations_approved_by` (`approved_by`),
  CONSTRAINT `fk_tbl_finance_reconciliations_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_reconciliations_created_by` FOREIGN KEY (`created_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_reconciliations`
--

LOCK TABLES `tbl_finance_reconciliations` WRITE;
/*!40000 ALTER TABLE `tbl_finance_reconciliations` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_finance_reconciliations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_reimbursements`
--

DROP TABLE IF EXISTS `tbl_finance_reimbursements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_reimbursements` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `submission_id` bigint unsigned NOT NULL,
  `member_id` bigint unsigned DEFAULT NULL,
  `requested_by_name` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requested_by_email` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requested_by_phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ministry_or_department` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requested_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `approved_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `payment_method` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reimbursement_method` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vendor_name` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `item_category` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `item_description` text COLLATE utf8mb4_unicode_ci,
  `purpose_of_purchase` text COLLATE utf8mb4_unicode_ci,
  `receipt_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `receipt_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_no` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `finance_notes` text COLLATE utf8mb4_unicode_ci,
  `status` enum('approved','rejected','paid') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'approved',
  `approved_by` bigint unsigned DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_finance_reimbursements_submission_id` (`submission_id`),
  KEY `idx_tbl_finance_reimbursements_member_id` (`member_id`),
  KEY `idx_tbl_finance_reimbursements_status` (`status`),
  KEY `idx_tbl_finance_reimbursements_reference_no` (`reference_no`),
  KEY `idx_tbl_finance_reimbursements_paid_at` (`paid_at`),
  KEY `idx_tbl_finance_reimbursements_approved_by` (`approved_by`),
  CONSTRAINT `fk_tbl_finance_reimbursements_submission` FOREIGN KEY (`submission_id`) REFERENCES `tbl_form_submissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_reimbursements`
--

LOCK TABLES `tbl_finance_reimbursements` WRITE;
/*!40000 ALTER TABLE `tbl_finance_reimbursements` DISABLE KEYS */;
INSERT INTO `tbl_finance_reimbursements` VALUES (1,3,1,'Kato Rocha','dopudy@mailinator.com','Nisi quis ad provide','Doloremque ducimus',3.00,0.00,'Credit Card','ACH','Deirdre Gillespie','1982-12-16','Magna sint quas eos','Veritatis harum poss','Ad sit aperiam quo e','/uploads/forms/1774635467425-hamsalomi.png','hamsalomi.png',NULL,NULL,'approved',NULL,NULL,NULL,0,'2026-03-27 13:17:47','2026-03-27 13:17:47');
/*!40000 ALTER TABLE `tbl_finance_reimbursements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_sunday_collections`
--

DROP TABLE IF EXISTS `tbl_finance_sunday_collections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_sunday_collections` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `collection_date` date NOT NULL,
  `service_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cash_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `check_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `zelle_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `card_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `counted_by` bigint unsigned DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tbl_finance_sunday_collections_date` (`collection_date`),
  KEY `idx_tbl_finance_sunday_collections_counted_by` (`counted_by`),
  KEY `idx_tbl_finance_sunday_collections_approved_by` (`approved_by`),
  CONSTRAINT `fk_tbl_finance_sunday_collections_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_sunday_collections_counted_by` FOREIGN KEY (`counted_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_sunday_collections`
--

LOCK TABLES `tbl_finance_sunday_collections` WRITE;
/*!40000 ALTER TABLE `tbl_finance_sunday_collections` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_finance_sunday_collections` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_finance_zelle_entries`
--

DROP TABLE IF EXISTS `tbl_finance_zelle_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_finance_zelle_entries` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `member_id` bigint unsigned DEFAULT NULL,
  `payment_id` bigint unsigned DEFAULT NULL,
  `full_name_snapshot` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone_snapshot` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sender_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sender_email` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sender_phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zelle_reference` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `received_date` datetime DEFAULT NULL,
  `received_by` bigint unsigned DEFAULT NULL,
  `approved_by` bigint unsigned DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `status` enum('received','approved','posted','voided') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'received',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tbl_finance_zelle_entries_member` (`member_id`),
  KEY `idx_tbl_finance_zelle_entries_payment` (`payment_id`),
  KEY `idx_tbl_finance_zelle_entries_status` (`status`),
  KEY `idx_tbl_finance_zelle_entries_amount` (`amount`),
  KEY `idx_tbl_finance_zelle_entries_received_date` (`received_date`),
  KEY `idx_tbl_finance_zelle_entries_received_by` (`received_by`),
  KEY `idx_tbl_finance_zelle_entries_approved_by` (`approved_by`),
  KEY `idx_tbl_finance_zelle_entries_created_by` (`created_by`),
  CONSTRAINT `fk_tbl_finance_zelle_entries_approved_by` FOREIGN KEY (`approved_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_zelle_entries_created_by` FOREIGN KEY (`created_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_zelle_entries_member` FOREIGN KEY (`member_id`) REFERENCES `tbl_members` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_zelle_entries_payment` FOREIGN KEY (`payment_id`) REFERENCES `tbl_finance_payments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tbl_finance_zelle_entries_received_by` FOREIGN KEY (`received_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_finance_zelle_entries`
--

LOCK TABLES `tbl_finance_zelle_entries` WRITE;
/*!40000 ALTER TABLE `tbl_finance_zelle_entries` DISABLE KEYS */;
INSERT INTO `tbl_finance_zelle_entries` VALUES (1,NULL,NULL,'abebe abebe','6154356525','abebe abebe','abebe@gmail.com','6154356525',NULL,300.00,'2026-03-23 08:29:00',28,NULL,28,'received','we received 300','2026-03-23 08:30:22'),(2,NULL,NULL,'Marta',NULL,'Marta','nat12@gmail.com',NULL,NULL,200.00,'2026-03-22 19:00:00',28,NULL,28,'received','collected','2026-03-23 11:23:54'),(3,NULL,NULL,'mulu asema',NULL,'mulu asema',NULL,NULL,NULL,300.00,'2026-03-25 19:00:00',28,NULL,28,'received','paid','2026-03-27 15:18:00');
/*!40000 ALTER TABLE `tbl_finance_zelle_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_form_submissions`
--

DROP TABLE IF EXISTS `tbl_form_submissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_form_submissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `form_key` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `form_name` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `submitted_by` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `baptismal_name` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'new',
  `priority` enum('low','normal','high','urgent') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `preferred_date` date DEFAULT NULL,
  `preferred_time` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payload_json` json NOT NULL,
  `attachment_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attachment_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attachment_size` int DEFAULT NULL,
  `assigned_to` bigint unsigned DEFAULT NULL,
  `reviewed_by` bigint unsigned DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `ip_address` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tbl_form_submissions_form_key` (`form_key`),
  KEY `idx_tbl_form_submissions_category` (`category`),
  KEY `idx_tbl_form_submissions_status` (`status`),
  KEY `idx_tbl_form_submissions_priority` (`priority`),
  KEY `idx_tbl_form_submissions_created_at` (`created_at`),
  KEY `idx_tbl_form_submissions_submitted_by` (`submitted_by`),
  KEY `idx_tbl_form_submissions_email` (`email`),
  KEY `idx_tbl_form_submissions_user_id` (`user_id`),
  KEY `idx_tbl_form_submissions_assigned_to` (`assigned_to`),
  KEY `idx_tbl_form_submissions_reviewed_by` (`reviewed_by`),
  KEY `idx_tbl_form_submissions_is_deleted` (`is_deleted`),
  KEY `idx_tbl_form_submissions_status_created` (`status`,`created_at`),
  KEY `idx_tbl_form_submissions_category_status` (`category`,`status`),
  KEY `idx_tbl_form_submissions_assigned_status` (`assigned_to`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_form_submissions`
--

LOCK TABLES `tbl_form_submissions` WRITE;
/*!40000 ALTER TABLE `tbl_form_submissions` DISABLE KEYS */;
INSERT INTO `tbl_form_submissions` VALUES (1,'confession','Confession Appointment','spiritual',NULL,'Brent Camacho','Ayanna Beard','adem@gmail.com','+1 (632) 956-9357','new','normal','2012-01-18','20:35','{\"email\": \"adem@gmail.com\", \"notes\": \"Labore sit in aut v\", \"phone\": \"+1 (632) 956-9357\", \"formType\": \"confession\", \"fullName\": \"Brent Camacho\", \"baptismalName\": \"Ayanna Beard\", \"preferredDate\": \"2012-01-18\", \"preferredTime\": \"20:35\"}',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',0,'2026-03-27 12:59:32','2026-03-27 12:59:32'),(2,'confession','Confession Appointment','spiritual',1,'Olivia Mccarty','Alice Roy','adem@gmail.com','+1 (795) 544-2669','new','normal','1991-11-02','15:51','{\"email\": \"adem@gmail.com\", \"notes\": \"Deserunt autem ducim\", \"phone\": \"+1 (795) 544-2669\", \"formType\": \"confession\", \"fullName\": \"Olivia Mccarty\", \"baptismalName\": \"Alice Roy\", \"preferredDate\": \"1991-11-02\", \"preferredTime\": \"15:51\"}',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'::1','Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',0,'2026-03-27 13:16:00','2026-03-27 13:16:00'),(3,'reimbursement','Reimbursement Request','finance',1,'Kato Rocha',NULL,'dopudy@mailinator.com','Nisi quis ad provide','new','normal','1982-12-16',NULL,'{\"email\": \"dopudy@mailinator.com\", \"fullName\": \"Kato Rocha\", \"signature\": \"Nam velit voluptate\", \"storeName\": \"Deirdre Gillespie\", \"preApproved\": \"no\", \"totalAmount\": \"3\", \"churchMember\": \"No\", \"itemCategory\": \"Magna sint quas eos \", \"purchaseDate\": \"1982-12-16\", \"paymentMethod\": \"Credit Card\", \"submissionDate\": \"1993-06-28\", \"itemDescription\": \"Veritatis harum poss\", \"purposeOfPurchase\": \"Ad sit aperiam quo e\", \"contactInformation\": \"Nisi quis ad provide\", \"reimbursementMethod\": \"ACH\", \"ministryOrDepartment\": \"Doloremque ducimus \"}','/uploads/forms/1774635467425-hamsalomi.png','hamsalomi.png',472656,NULL,NULL,NULL,NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',1,'2026-03-27 13:17:47','2026-03-27 14:02:34'),(4,'choir','Choir Registration','service',1,'nati Tsega',NULL,'nat12@gmail.com','5555555555','new','normal','2026-03-18','00:00','{\"email\": \"nat12@gmail.com\", \"notes\": \"test\", \"phone\": \"5555555555\", \"fullName\": \"nati Tsega\", \"baptismalName\": \"\", \"preferredDate\": \"2026-03-18\", \"preferredTime\": \"00:00\"}',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'::1','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',0,'2026-03-27 15:19:13','2026-03-27 15:19:13');
/*!40000 ALTER TABLE `tbl_form_submissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_media_albums`
--

DROP TABLE IF EXISTS `tbl_media_albums`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_media_albums` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(180) NOT NULL,
  `description` text,
  `cover_image_url` varchar(500) DEFAULT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_media_albums_published` (`is_published`),
  KEY `idx_media_albums_created_by` (`created_by`),
  CONSTRAINT `fk_media_albums_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_media_albums`
--

LOCK TABLES `tbl_media_albums` WRITE;
/*!40000 ALTER TABLE `tbl_media_albums` DISABLE KEYS */;
INSERT INTO `tbl_media_albums` VALUES (10,'church photo',NULL,'http://localhost:5000/uploads/gallery/1773360287512-image.png',1,1,'2026-03-12 19:04:47','2026-03-12 19:04:47'),(11,'church photo',NULL,'http://localhost:5000/uploads/gallery/1773360313822-image1.png',1,1,'2026-03-12 19:05:13','2026-03-12 19:05:13'),(23,'test',NULL,'http://localhost:5000/uploads/gallery/1773434482796-kesis_tesfa.jpg',1,1,'2026-03-13 15:41:22','2026-03-13 15:41:22'),(26,'photo','photo','http://localhost:5000/uploads/gallery/1773434547627-kesis_tadesse.jpg',1,1,'2026-03-13 15:42:27','2026-03-13 15:42:27'),(27,'photo','photo','http://localhost:5000/uploads/gallery/1773434571324-kesis_fanuel.jpg',1,1,'2026-03-13 15:42:51','2026-03-13 15:42:51'),(28,'photo','photo','http://localhost:5000/uploads/gallery/1773434590571-kesis_tesfa.jpg',1,1,'2026-03-13 15:43:10','2026-03-13 15:43:10'),(29,'photo','photo','http://localhost:5000/uploads/gallery/1773434666810-image1.png',1,1,'2026-03-13 15:44:26','2026-03-13 15:44:26');
/*!40000 ALTER TABLE `tbl_media_albums` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_media_photos`
--

DROP TABLE IF EXISTS `tbl_media_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_media_photos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `album_id` int NOT NULL,
  `image_url` varchar(500) NOT NULL,
  `caption` varchar(255) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_published` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_media_photos_album` (`album_id`),
  KEY `idx_media_photos_published` (`is_published`),
  CONSTRAINT `fk_media_photos_album` FOREIGN KEY (`album_id`) REFERENCES `tbl_media_albums` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_media_photos`
--

LOCK TABLES `tbl_media_photos` WRITE;
/*!40000 ALTER TABLE `tbl_media_photos` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_media_photos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_member_dependents`
--

DROP TABLE IF EXISTS `tbl_member_dependents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_member_dependents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `member_id` bigint unsigned NOT NULL,
  `dependent_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(180) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `relationship` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `dependent_type` enum('dependent','spouse','child','parent','other') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'dependent',
  `gender` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `email` varchar(190) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_student` tinyint(1) NOT NULL DEFAULT '0',
  `is_disabled` tinyint(1) NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `status` enum('active','inactive','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_member_dependents_dependent_no` (`dependent_no`),
  KEY `idx_tbl_member_dependents_member_id` (`member_id`),
  KEY `idx_tbl_member_dependents_member_active` (`member_id`,`is_active`),
  KEY `idx_tbl_member_dependents_member_status` (`member_id`,`status`),
  KEY `idx_tbl_member_dependents_last_first` (`last_name`,`first_name`),
  KEY `idx_tbl_member_dependents_full_name` (`full_name`),
  KEY `idx_tbl_member_dependents_relationship` (`relationship`),
  KEY `idx_tbl_member_dependents_dob` (`date_of_birth`),
  KEY `idx_tbl_member_dependents_created_at` (`created_at`),
  CONSTRAINT `fk_tbl_member_dependents_member_id` FOREIGN KEY (`member_id`) REFERENCES `tbl_members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_member_dependents`
--

LOCK TABLES `tbl_member_dependents` WRITE;
/*!40000 ALTER TABLE `tbl_member_dependents` DISABLE KEYS */;
INSERT INTO `tbl_member_dependents` VALUES (1,1,'D-00001','Dama','Adem','Dama Adem','child','child',NULL,'2026-03-10','abel2@gmail.com',NULL,0,0,1,'active',NULL,'2026-03-25 19:49:27','2026-03-25 19:49:27'),(2,1,'D-00002','Tsega','Belay','Tsega Belay','child','child',NULL,'2023-06-06','abel2@gmail.com',NULL,0,0,1,'active',NULL,'2026-03-26 06:33:05','2026-03-26 07:00:56'),(3,1,'D-00003','nati','Tsega','nati Tsega','child','child',NULL,'2026-03-10','nat12@gmail.com','5555555555',0,0,1,'active',NULL,'2026-03-27 15:15:14','2026-03-27 15:15:14'),(4,18,'D-00004','kal','Tsega','kal Tsega','spouse','spouse',NULL,'2026-03-18','nat12@gmail.com','5555555555',0,0,1,'active',NULL,'2026-03-27 19:00:24','2026-03-27 19:00:24');
/*!40000 ALTER TABLE `tbl_member_dependents` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_tbl_member_dependents_au` AFTER UPDATE ON `tbl_member_dependents` FOR EACH ROW BEGIN
  UPDATE tbl_members m
  SET
    m.dependents_count = (
      SELECT COUNT(*)
      FROM tbl_member_dependents d
      WHERE d.member_id = OLD.member_id
        AND d.is_active = 1
        AND d.status = 'active'
    ),
    m.household_member_count = 1 + (
      SELECT COUNT(*)
      FROM tbl_member_dependents d
      WHERE d.member_id = OLD.member_id
        AND d.is_active = 1
        AND d.status = 'active'
    ),
    m.updated_at = NOW()
  WHERE m.id = OLD.member_id;

  IF NEW.member_id <> OLD.member_id THEN
    UPDATE tbl_members m
    SET
      m.dependents_count = (
        SELECT COUNT(*)
        FROM tbl_member_dependents d
        WHERE d.member_id = NEW.member_id
          AND d.is_active = 1
          AND d.status = 'active'
      ),
      m.household_member_count = 1 + (
        SELECT COUNT(*)
        FROM tbl_member_dependents d
        WHERE d.member_id = NEW.member_id
          AND d.is_active = 1
          AND d.status = 'active'
      ),
      m.updated_at = NOW()
    WHERE m.id = NEW.member_id;
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `tbl_members`
--

DROP TABLE IF EXISTS `tbl_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_members` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `member_no` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_line1` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address_line2` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zip` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `member_type` enum('existing','new') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'new',
  `registration_fee_status` enum('unpaid','paid','waived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'waived',
  `registration_paid_at` datetime DEFAULT NULL,
  `status` enum('pending','active','inactive','disabled','delinquent') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `membership_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `open_balance` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_paid` decimal(12,2) NOT NULL DEFAULT '0.00',
  `last_payment_at` datetime DEFAULT NULL,
  `next_due_at` datetime DEFAULT NULL,
  `dependents_count` int unsigned NOT NULL DEFAULT '0',
  `household_member_count` int unsigned NOT NULL DEFAULT '1',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_members_email` (`email`),
  UNIQUE KEY `uq_tbl_members_member_no` (`member_no`),
  KEY `idx_tbl_members_full_name` (`full_name`),
  KEY `idx_tbl_members_last_first` (`last_name`,`first_name`),
  KEY `idx_tbl_members_phone` (`phone`),
  KEY `idx_tbl_members_status` (`status`),
  KEY `idx_tbl_members_is_active` (`is_active`),
  KEY `idx_tbl_members_created_at` (`created_at`),
  KEY `idx_tbl_members_dependents_count` (`dependents_count`),
  KEY `idx_tbl_members_household_member_count` (`household_member_count`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_members`
--

LOCK TABLES `tbl_members` WRITE;
/*!40000 ALTER TABLE `tbl_members` DISABLE KEYS */;
INSERT INTO `tbl_members` VALUES (1,'M-00001','Nigusea','Dessie','Nigusea Dessie','nigusea@gmail.com','+61645542701','5652 rice rd',NULL,'Antioch','Tennessee','37013','new','waived',NULL,'active','active',1,0.00,0.00,NULL,NULL,3,4,NULL,'2026-03-22 12:09:59','2026-03-27 15:15:14'),(2,'M-00002','Abebe','Dessie','Abebe Dessie','abebe@gmail.com','+15555555555','5652 rice rd',NULL,'Antioch','Tennessee','37013','new','waived',NULL,'active','active',1,0.00,0.00,NULL,NULL,0,1,NULL,'2026-03-22 12:11:09','2026-03-22 12:11:09'),(3,'M-00003','nati','Tsega','nati Tsega','nat12@gmail.com','+15555555555','5652 rice rd',NULL,'Antioch','Tennessee','37013','new','waived',NULL,'active','active',1,0.00,0.00,NULL,NULL,0,1,NULL,'2026-03-22 12:12:31','2026-03-22 12:12:31'),(6,'M-00006','Mulu','Adem','Mulu Adem','mulu@gmail.com','+15555125585','5652 rice rd',NULL,'Antioch','Tennessee','37013','new','unpaid',NULL,'pending','pending',0,0.00,0.00,NULL,NULL,0,1,NULL,'2026-03-23 18:58:25','2026-03-23 18:58:25'),(7,'M-00007','Maru','Tsega','Maru Tsega','maru@gmail.com','+15555555555','5652 rice rd',NULL,'Antioch','Tennessee','37013','existing','waived',NULL,'active','active',1,0.00,0.00,NULL,NULL,0,1,NULL,'2026-03-23 19:42:09','2026-03-23 19:42:09'),(8,'M-00008','kal','Adem','kal Adem','kal@gmail.com',NULL,'5652 rice rd',NULL,'Antioch','Tennessee','37013','new','unpaid',NULL,'pending','pending',0,0.00,0.00,NULL,NULL,0,1,NULL,'2026-03-23 20:48:40','2026-03-23 20:48:40'),(11,'M-00011','Melaku','wale','Melaku wale','melaku@gmail.com',NULL,'5652 rice rd',NULL,'Antioch','Tennessee','37013','new','unpaid',NULL,'pending','pending',1,0.00,0.00,NULL,NULL,0,1,NULL,'2026-03-26 06:37:45','2026-03-26 06:37:45'),(12,'M-00012','Meseret','Adem','Meseret Adem','meseret@gmail.com',NULL,'5652 rice rd',NULL,'Antioch','Tennessee','37013','new','unpaid',NULL,'pending','pending',1,0.00,0.00,NULL,NULL,0,1,NULL,'2026-03-26 07:02:37','2026-03-26 07:02:37'),(13,'M-00013','hawa','Tsega','hawa Tsega','hawa@gmail.com','+15555555555','5652 rice rd',NULL,'Antioch','Tennessee','37013','new','unpaid',NULL,'pending','pending',1,0.00,0.00,NULL,NULL,0,1,NULL,'2026-03-26 16:29:24','2026-03-26 16:29:24'),(14,'M-00014','mat','Adem','mat Adem','mat@gmail.com',NULL,'5652 rice rd',NULL,'Antioch','Tennessee','37013','new','unpaid',NULL,'pending','pending',1,0.00,0.00,NULL,NULL,0,1,NULL,'2026-03-26 17:12:52','2026-03-26 17:12:52'),(15,'M-00015','Mekal','Tsega','Mekal Tsega','mek@gmail.com','+15555555555','5652 rice rd',NULL,'Antioch','Tennessee','37013','new','unpaid',NULL,'pending','pending',1,0.00,0.00,NULL,NULL,0,1,NULL,'2026-03-26 17:38:16','2026-03-26 17:38:16'),(16,'M-00016','Meba','Tsega','Meba Tsega','meba@gmail.com','+15555551234','5652 rice rd',NULL,'Antioch','Tennessee','37013','new','unpaid',NULL,'pending','pending',1,0.00,0.00,NULL,NULL,0,1,NULL,'2026-03-26 20:40:18','2026-03-26 20:40:18'),(17,'M-00017','mamo','Tsega','mamo Tsega','mamo@gmail.com','+15555555555','5652 rice rd',NULL,'Antioch','Tennessee','37013','new','unpaid',NULL,'pending','pending',1,0.00,0.00,NULL,NULL,0,1,NULL,'2026-03-27 18:48:46','2026-03-27 18:48:46'),(18,'M-00018','nati','Tsega','nati Tsega','nat111@gmail.com','+15555555555','5652 rice rd',NULL,'Antioch','Tennessee','37013','new','unpaid',NULL,'pending','pending',1,0.00,0.00,NULL,NULL,1,2,NULL,'2026-03-27 18:56:45','2026-03-27 19:00:24'),(19,'M-00019','moka','Tsega','moka Tsega','moka@gmail.com','5555555555','5652 rice rd',NULL,'Antioch','Tennessee','37013','existing','waived',NULL,'active','active',1,0.00,0.00,NULL,NULL,0,1,NULL,'2026-03-28 10:30:44','2026-03-28 10:30:44'),(20,'M-00020','buta','Tsega','buta Tsega','buta@gmail.com','+15555555555','5652 rice rd',NULL,'Antioch','Tennessee','37013','new','unpaid',NULL,'pending','pending',1,0.00,0.00,NULL,NULL,0,1,NULL,'2026-03-28 17:07:29','2026-03-28 17:07:29');
/*!40000 ALTER TABLE `tbl_members` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_tbl_members_full_name_bi` BEFORE INSERT ON `tbl_members` FOR EACH ROW BEGIN
  SET NEW.full_name = TRIM(CONCAT(COALESCE(NEW.first_name,''), ' ', COALESCE(NEW.last_name,'')));
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_tbl_members_full_name_bu` BEFORE UPDATE ON `tbl_members` FOR EACH ROW BEGIN
  SET NEW.full_name = TRIM(CONCAT(COALESCE(NEW.first_name,''), ' ', COALESCE(NEW.last_name,'')));
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `tbl_news_events`
--

DROP TABLE IF EXISTS `tbl_news_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_news_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category` enum('holiday','trip','kids','news') NOT NULL DEFAULT 'news',
  `title` varchar(200) NOT NULL,
  `subtitle` varchar(255) DEFAULT NULL,
  `summary` text,
  `body_html` longtext,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `time_text` varchar(120) DEFAULT NULL,
  `location` varchar(200) DEFAULT NULL,
  `audience` varchar(255) DEFAULT NULL,
  `flyer_url` varchar(500) DEFAULT NULL,
  `pdf_url` varchar(500) DEFAULT NULL,
  `pdf_title` varchar(255) DEFAULT NULL,
  `holiday_color` varchar(20) DEFAULT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tbl_news_events_category` (`category`),
  KEY `idx_tbl_news_events_dates` (`start_date`,`end_date`),
  KEY `idx_tbl_news_events_published` (`is_published`),
  KEY `idx_tbl_news_events_category_published_date` (`category`,`is_published`,`start_date`),
  KEY `idx_tbl_news_events_title` (`title`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_news_events`
--

LOCK TABLES `tbl_news_events` WRITE;
/*!40000 ALTER TABLE `tbl_news_events` DISABLE KEYS */;
INSERT INTO `tbl_news_events` VALUES (1,'kids','Easter day',NULL,NULL,NULL,'2026-03-28','2026-03-30',NULL,'525 ruce rd',NULL,NULL,NULL,NULL,'green',1,'2026-03-27 22:02:58','2026-03-27 22:02:58'),(2,'kids','school',NULL,'test','Holy Trinity Ethiopian Orthodox Tewahedo Church is a vibrant spiritual community dedicated to preserving our ancient faith while serving our modern world. We welcome all who seek to grow in their relationship with God\r\nHoly Trinity Ethiopian Orthodox Tewahedo Church is a vibrant spiritual community dedicated to preserving our ancient faith while serving our modern world. We welcome all who seek to grow in their relationship with God','2026-03-27','2026-03-27','18:00 - 20:00','5354vrucecrd',NULL,'http://localhost:5000/uploads/news-events/1774651968273-357645981.jpeg',NULL,NULL,NULL,1,'2026-03-27 22:52:48','2026-03-27 22:52:48'),(3,'kids','test',NULL,'come to scholl','Holy Trinity Ethiopian Orthodox Tewahedo Church is a vibrant spiritual community dedicated to preserving our ancient faith while serving our modern world. We welcome all who seek to grow in their relationship with God Holy Trinity Ethiopian Orthodox Tewahedo Church is a vibrant spiritual community dedicated to preserving our ancient faith while serving our modern world. We welcome all who seek to grow in their relationship with God','2026-03-28','2026-03-28','17:00 - 18:00','5161 rice rd',NULL,'http://localhost:5000/uploads/news-events/1774652132504-275428724.png',NULL,NULL,NULL,1,'2026-03-27 22:55:32','2026-03-27 22:55:32'),(4,'kids','test','test','test','Holy Trinity Ethiopian Orthodox Tewahedo Church is a vibrant spiritual community dedicated to preserving our ancient faith while serving our modern world. We welcome all who seek to grow in their relationship with God Holy Trinity Ethiopian Orthodox Tewahedo Church is a vibrant spiritual community dedicated to preserving our ancient faith while serving our modern world. We welcome all who seek to grow in their relationship with God','2026-03-27','2026-03-27','17:00 - 19:00','5161 rice rd',NULL,'http://localhost:5000/uploads/news-events/1774652215328-192176284.jpeg',NULL,NULL,NULL,1,'2026-03-27 22:56:55','2026-03-27 22:56:55'),(5,'holiday','easter','test','come','Holy Trinity Ethiopian Orthodox Tewahedo Church is a vibrant spiritual community dedicated to preserving our ancient faith while serving our modern world. We welcome all who seek to grow in their relationship with God Holy Trinity Ethiopian Orthodox Tewahedo Church is a vibrant spiritual community dedicated to preserving our ancient faith while serving our modern world. We welcome all who seek to grow in their relationship with God','2026-03-28',NULL,'09:18 - 22:16',NULL,NULL,NULL,NULL,NULL,'#4A75E6',1,'2026-03-27 23:17:17','2026-03-27 23:17:17');
/*!40000 ALTER TABLE `tbl_news_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_password_resets`
--

DROP TABLE IF EXISTS `tbl_password_resets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_password_resets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `member_id` bigint unsigned NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_password_resets_token_hash` (`token_hash`),
  KEY `idx_tbl_password_resets_member` (`member_id`),
  KEY `idx_tbl_password_resets_expires` (`expires_at`),
  CONSTRAINT `fk_tbl_password_resets_member` FOREIGN KEY (`member_id`) REFERENCES `tbl_members` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_password_resets`
--

LOCK TABLES `tbl_password_resets` WRITE;
/*!40000 ALTER TABLE `tbl_password_resets` DISABLE KEYS */;
/*!40000 ALTER TABLE `tbl_password_resets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_refresh_tokens`
--

DROP TABLE IF EXISTS `tbl_refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_refresh_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_refresh_tokens_token_hash` (`token_hash`),
  KEY `idx_tbl_refresh_tokens_user_id` (`user_id`),
  KEY `idx_tbl_refresh_tokens_expires_at` (`expires_at`),
  CONSTRAINT `fk_tbl_refresh_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `tbl_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=673 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_refresh_tokens`
--

LOCK TABLES `tbl_refresh_tokens` WRITE;
/*!40000 ALTER TABLE `tbl_refresh_tokens` DISABLE KEYS */;
INSERT INTO `tbl_refresh_tokens` VALUES (1,1,'e6889fb439bfd5e14d2d956192634d8f8d40ace0ce9587a3a5c61c38ef80bbad','2026-04-05 12:09:59',NULL,'2026-03-22 12:09:59'),(2,2,'a9268163fe04aeb254f78a84d9062336a62d4c52e23af8ff8c75ba0515c123af','2026-04-05 12:11:09',NULL,'2026-03-22 12:11:09'),(3,3,'0ccc17a0ccb51d3b39d1a21140062b2165392217bdde4e7599801d73e73fa424','2026-04-05 12:12:31','2026-03-22 12:36:56','2026-03-22 12:12:31'),(6,3,'012db1028ab0a51a62965683e5af68d1b64bf3fb13b2b13238e7abca588cf571','2026-04-05 12:36:56','2026-03-22 13:04:16','2026-03-22 12:36:56'),(10,3,'e443b12bc717f06bb014b1f5650c1df57537506d5f850d36f377adf3dcbb8b62','2026-04-05 13:04:17','2026-03-22 13:04:21','2026-03-22 13:04:16'),(11,3,'0d8797dcca986850fbdef74b7b0007cc7da3d260c40ac8ae48982086bbc5fbaf','2026-04-05 13:04:22',NULL,'2026-03-22 13:04:21'),(12,1,'1c487a5880cb30f47f23a9f7d65ac9c4a4aebf13576f8b1f5674f55df6c42d00','2026-04-05 13:20:58','2026-03-22 13:33:58','2026-03-22 13:20:58'),(13,1,'a202faaedcd06c3a2101ae91a552357021394cc49f27349956c9323a8fdebacc','2026-04-05 13:33:58','2026-03-22 13:34:00','2026-03-22 13:33:58'),(14,1,'4f2b79dc8784763e909df0ef0d0ccfefc208eb695e7b9406d386498a7059a67f','2026-04-05 13:34:01','2026-03-22 13:35:39','2026-03-22 13:34:00'),(15,1,'5da433bb33c92c67ce05e3a8362483e80ddcb9e090ad44274c85061a8ae7ccee','2026-04-05 13:35:40','2026-03-22 14:04:57','2026-03-22 13:35:39'),(16,1,'1e84d20194e6cb7f7086aee4592ff5d31a87da28313e8cc0e2b3cb2438139a30','2026-04-05 14:04:58','2026-03-22 14:04:58','2026-03-22 14:04:57'),(17,1,'757c7bed0fc73c78d891af10b429588829d14adf57a619381816cb88865b2f6a','2026-04-05 14:04:58','2026-03-22 14:04:58','2026-03-22 14:04:58'),(18,1,'a28f33e4fdbeeeed0c874ff5d6679445c36f10927b973f13ea259a885f8fba0b','2026-04-05 14:04:58','2026-03-22 14:29:42','2026-03-22 14:04:58'),(19,1,'e95a107b88822dad77b136e38a32a87de0f81ac2444ac28771f74606f4ce0f53','2026-04-05 14:29:42','2026-03-22 14:29:42','2026-03-22 14:29:42'),(20,1,'3b51fbf95dc6344fe85673f77c854763fac7cf8e698434e45ced808ef1a0ec96','2026-04-05 14:29:42','2026-03-22 14:29:42','2026-03-22 14:29:42'),(21,1,'360d6142ec130e32c9fa127a3a049258966ebb4629e2d6104f55fb2a73ba0de2','2026-04-05 14:29:43',NULL,'2026-03-22 14:29:42'),(22,1,'01759564705b3edaa10355bc6c7816bbb7c0a67cbb91f39c2e6b35fcae7afc6b','2026-04-05 14:32:25','2026-03-22 14:41:51','2026-03-22 14:32:25'),(23,1,'9af1d9bc4a4bb8ad5030d7a360a648fa5bbab2922a643dba57fc0fe140ee8c18','2026-04-05 14:41:51','2026-03-22 14:41:51','2026-03-22 14:41:51'),(24,1,'519914b6766eacfecc68cf06476817baa194d05cb0fd73cdb37f3b74f38446d5','2026-04-05 14:41:52','2026-03-22 14:41:52','2026-03-22 14:41:51'),(25,1,'61fc0c1b6e8246a9ab68f01451d8006f61d7b1f4e534bc8586f906fe5189fa54','2026-04-05 14:41:52','2026-03-22 15:06:07','2026-03-22 14:41:52'),(26,1,'79e41d06ab0105585561d1deaeba908feacc5c52fb13aeb546989119084965c9','2026-04-05 15:06:08','2026-03-22 15:06:07','2026-03-22 15:06:07'),(27,1,'a1c7b5dbc8774c815b0d9eae4c6044671ba03ec266b79ea9375997524ea80c43','2026-04-05 15:06:08','2026-03-22 15:06:08','2026-03-22 15:06:08'),(28,1,'d24aaeb1af6ae3b2c2aca3db249859965d1f49845124e77861ff910869e63f7a','2026-04-05 15:06:08','2026-03-22 15:06:15','2026-03-22 15:06:08'),(29,1,'c32ceba9938c2b86d1ba627bf6cdb1a0347f7a1fcb80ab99ea0353c853483ee3','2026-04-05 15:06:16','2026-03-22 15:06:15','2026-03-22 15:06:15'),(30,1,'a25115c8dbea02736557f049050328b92f95b87530693f4042b83f993604ae9f','2026-04-05 15:06:16','2026-03-22 15:07:26','2026-03-22 15:06:15'),(31,1,'b46848b28dbf6be39be9f25912963a3469a9edc06714f53365de1b591e7a28fb','2026-04-05 15:07:27','2026-03-22 15:08:23','2026-03-22 15:07:26'),(32,1,'1a5add90722162ee66e52ba1b1e4dd678a9a508353a4ed8999db7c78f8047d7c','2026-04-05 15:08:24','2026-03-22 15:36:57','2026-03-22 15:08:23'),(33,1,'8d35f73a116bb724d7e732430f72677a640984765ace177bfa218338b7dfa608','2026-04-05 15:36:58','2026-03-22 15:47:33','2026-03-22 15:36:57'),(34,1,'7cc57011616e39eca35169b4bbde9f6643a130ae51fee13deb668b084cc46e71','2026-04-05 15:47:34','2026-03-22 19:25:43','2026-03-22 15:47:33'),(35,1,'f05508ef3aa03cf5269e8594af42158daaa5858bb92399cd77d21f5fdf17416c','2026-04-05 19:25:44',NULL,'2026-03-22 19:25:43'),(36,1,'5efca670d7d84a42e5c86611551e247d2120de634dd99100312aed4e32ce43b4','2026-04-05 19:25:44','2026-03-22 19:25:47','2026-03-22 19:25:43'),(37,1,'aec6ed4c85ab08d32e6caae463211a3b4041034ed60875779871326a3aa6e7fb','2026-04-05 19:25:47','2026-03-22 19:28:24','2026-03-22 19:25:47'),(38,1,'b20bd9bb73080a9f93524bb375bca40966cfe4d257af093fd16abbda3d633886','2026-04-05 19:28:25','2026-03-22 19:28:25','2026-03-22 19:28:24'),(39,1,'b422d530679b9dfec0364db38a534e7a3aca18e493ec694ec521424c4c14e931','2026-04-05 19:28:25','2026-03-22 19:57:26','2026-03-22 19:28:25'),(40,1,'ee9d88e096a280f4f77ad9abe45e2171b9b4ac93c7f0481d05408a88cfc0fccc','2026-04-05 19:57:26','2026-03-22 19:57:26','2026-03-22 19:57:26'),(41,1,'61d62a05060213813caa255ddf2ae0f74b086500a892bc503068931a655cf4cb','2026-04-05 19:57:26','2026-03-22 19:57:26','2026-03-22 19:57:26'),(42,1,'815ade17feb9a3aedb2f43f79cf68008a3aa9a7d29282ae31d1087bc7452104f','2026-04-05 19:57:26','2026-03-22 19:59:53','2026-03-22 19:57:26'),(43,1,'a68a93289ad3706bda9bd5ad5d2b1d89382328677ab25af857da86be38b5942e','2026-04-05 19:59:54',NULL,'2026-03-22 19:59:53'),(44,28,'0006220604d316c98c93293a3e4ce9accf5d578755622447842029242f63d646','2026-04-05 20:00:08','2026-03-22 20:03:18','2026-03-22 20:00:07'),(45,28,'619cc2dad6f74e6be1cd18ecb8e69d51f0cf0ae37ada481098dfa15a906c8250','2026-04-05 20:03:18',NULL,'2026-03-22 20:03:18'),(46,29,'68e0b145a22f169237f85fee183c494f3355e8f57f1fc546c6c36012cb3eeb2c','2026-04-05 20:03:40','2026-03-22 20:04:07','2026-03-22 20:03:40'),(47,29,'beec9e48cba0b585c2a25a69c779903eafae1d06be0f9466020d5eb5cccb9ef8','2026-04-05 20:04:08',NULL,'2026-03-22 20:04:07'),(48,1,'304f20d3d5ca1edf28ecb9b6c61fe17882ac25121685bd878cf0d0586308d0fc','2026-04-05 20:04:44','2026-03-22 20:05:33','2026-03-22 20:04:43'),(49,1,'24e6ac6c1eea84df5d2db4b34dd173689abb0d9105398f6332d2f4801bcdf189','2026-04-05 20:05:33','2026-03-22 20:05:54','2026-03-22 20:05:33'),(50,1,'46fe2dffcda4e5682288606509bd6ab39ac4c986c133d37ddfe0ec8ee03285d9','2026-04-05 20:05:54','2026-03-22 20:18:54','2026-03-22 20:05:54'),(51,1,'11b914bd26454813389887baf6c6fc7fd26b693ed2b5dbdb6e54caa52fec3e04','2026-04-05 20:18:55','2026-03-22 20:18:59','2026-03-22 20:18:54'),(52,1,'9ab1eb569517606f6218ad25ef30476633f00d105da8aef16f80f03768414fad','2026-04-05 20:19:00',NULL,'2026-03-22 20:18:59'),(53,1,'02d720be57446d5f88086128e4abfe7ea3752a39fc1bfc65366621c7024e03a9','2026-04-05 20:19:00','2026-03-22 20:19:00','2026-03-22 20:18:59'),(54,1,'4cd3f98bdb6ca453c6bae67db1331aaae4d491e53ec9a493b099b7b35087d17f','2026-04-05 20:19:00',NULL,'2026-03-22 20:19:00'),(55,28,'746f1097ea823471bc00d2465c25e5fb2fc61813e3d0462255a557a17c61f9ff','2026-04-05 20:19:29','2026-03-22 20:49:38','2026-03-22 20:19:29'),(56,28,'74d20157f3701b5028f4cf0d53078e72dae930d56982b53a5266fdb74c3be9a6','2026-04-05 20:49:38','2026-03-22 20:49:38','2026-03-22 20:49:38'),(57,28,'8b726e3a95c24ce75eaf49aa09143a5d1d0b3e296fe396b330bcb369ed40bc2c','2026-04-05 20:49:38','2026-03-22 20:49:38','2026-03-22 20:49:38'),(58,28,'927e2b6e81f9d61c84747f2b2536ffc00383f81c8c0dbeea78af8ab4254c525e','2026-04-05 20:49:39',NULL,'2026-03-22 20:49:38'),(59,28,'3d8cfc1cb85d678f3fe7065932c44f4670e99aa8ee32aa85478cbbb58b38a1dc','2026-04-05 20:49:39','2026-03-22 20:49:38','2026-03-22 20:49:38'),(60,28,'76efb34213db1d848785230a3cab08ac53147bbad04837541069fb658f274d6d','2026-04-05 20:49:39','2026-03-22 20:49:39','2026-03-22 20:49:38'),(61,28,'dbe1435c70fb88f3a0672d2a1a8c08106bd2c1f61ed8367eb45c1a9eea5f543a','2026-04-05 20:49:39','2026-03-22 20:49:39','2026-03-22 20:49:39'),(62,28,'a322587b031b9545427db5ad249477961a24dfd8becb05f9192ebb53e97f7d3b','2026-04-05 20:49:39','2026-03-22 20:56:43','2026-03-22 20:49:39'),(63,28,'8fe2a857c79331defbbd136c5bceab22399ae8e90b67364eab02dd633d6d354d','2026-04-05 20:56:44','2026-03-22 20:56:43','2026-03-22 20:56:43'),(64,28,'7efb97cd85db16318a7f53312a316872314871419fb16cd8a35ffcb0cfb72cf5','2026-04-05 20:56:44','2026-03-22 21:10:17','2026-03-22 20:56:43'),(65,28,'b832e34db538c56d45865ddd6ba14a9e2d0bb7f09f1c370532a07151a55594bc','2026-04-05 21:10:18','2026-03-22 21:26:39','2026-03-22 21:10:17'),(66,28,'2bc3eb1b33fc2958c936a8ad48d4701001582e204c8d3951f01136ef4e2a2f1f','2026-04-05 21:26:39','2026-03-22 21:46:03','2026-03-22 21:26:39'),(67,28,'642986860e8385c384a5ac96d4bcdf6ed74354bd9b9e410df9cd7dd433ca542c','2026-04-05 21:46:04','2026-03-22 21:46:04','2026-03-22 21:46:03'),(68,28,'4a5d1fb879a583d128525078f1790fadb505a217b4d57f68be862b0adc892a1d','2026-04-05 21:46:05','2026-03-22 21:46:06','2026-03-22 21:46:04'),(69,28,'483f437b6871f278eafcf2ed8d67fbe1dcb93461b78e07e13e4141f26d2c3046','2026-04-05 21:46:07','2026-03-22 21:46:06','2026-03-22 21:46:06'),(70,28,'e3fcc1030e911027c21dfac36a025a7017a021aabaff2c7c2eb331227ab64c9a','2026-04-05 21:46:07','2026-03-22 21:46:07','2026-03-22 21:46:06'),(71,28,'6e916f7adc848308f179f6af48c03e09fa9c9ff4d59a4fc34829716572647e2f','2026-04-05 21:46:07','2026-03-22 21:59:20','2026-03-22 21:46:07'),(72,28,'efc642d27a6f19cb9c2f4a765ffb8218531c0b77cb7a671566b45e7c6093b946','2026-04-05 21:59:21','2026-03-22 21:59:20','2026-03-22 21:59:20'),(73,28,'ec879af26242bec9b850e9867590f893d867e5b1fd9d98f4800298323b5eacd1','2026-04-05 21:59:21','2026-03-22 21:59:20','2026-03-22 21:59:20'),(74,28,'b55c034ebf8bd395056c03380b99961325ce3a5a2105b82670eb3ac3d07120a1','2026-04-05 21:59:21','2026-03-22 22:11:54','2026-03-22 21:59:20'),(75,28,'0894c02137f1d76dd7238f114e7558541591178acf2788a8d958183cba70a60c','2026-04-05 22:11:54','2026-03-22 22:34:48','2026-03-22 22:11:54'),(76,28,'77fe5987943a9b723b10eea48d721c692d16a5a6959879493e0c9e95106795dc','2026-04-05 22:34:49','2026-03-22 22:46:47','2026-03-22 22:34:48'),(77,28,'40bd0f88917e4d4f017a9a6aba70d596287cfb6e44d98f9e3220c3cf3148452a','2026-04-05 22:46:48','2026-03-22 22:46:47','2026-03-22 22:46:47'),(78,28,'8521464d3202e5a88a660bad8d3dbd469afb02b21547645b58ecf23f4cf45c43','2026-04-05 22:46:48','2026-03-22 22:46:47','2026-03-22 22:46:47'),(79,28,'0630d8b2ff1a4ea7b73fb6baa1f25f3c4d0d0fdcda13823f2e70090f643c6722','2026-04-05 22:46:48','2026-03-22 22:46:48','2026-03-22 22:46:47'),(80,28,'9862184127d1ec11726dded9c7512d194f17953eb04875f58f38d9664f850d23','2026-04-05 22:46:48','2026-03-22 22:58:20','2026-03-22 22:46:48'),(81,28,'ad1c1364254e2a888b351c5287009e528b48d1e37e184d62a3a8e465f5ccc6e1','2026-04-05 22:58:20','2026-03-22 22:58:20','2026-03-22 22:58:20'),(82,28,'627211d177bc3505b2e07f66b7973a629f87ce35419cfc7826242ebce110805b','2026-04-05 22:58:20','2026-03-22 22:58:20','2026-03-22 22:58:20'),(83,28,'30999b192f75eed4f24610882ae56c3eadb206bc8f620509f55459115a66542f','2026-04-05 22:58:20','2026-03-22 22:58:20','2026-03-22 22:58:20'),(84,28,'08ea226972499af91ecc5bb74c4695153fb85b5b0d6acb360dec41c4adb5e49d','2026-04-05 22:58:21','2026-03-22 22:58:20','2026-03-22 22:58:20'),(85,28,'5bee12a6aafc5e247412d9b8770598f290518d700b215bc0e15c89ff81b476f9','2026-04-05 22:58:21','2026-03-22 22:58:21','2026-03-22 22:58:20'),(86,28,'acfe7e301b0852582a45d168da59d0d1933d0c81db0d5bbee2970e033454c7f2','2026-04-05 22:58:21','2026-03-22 22:58:21','2026-03-22 22:58:21'),(87,28,'0beccdc4824f21f0af11a70825c355932595fedc38ff8b3c47c707e5f5fc26e8','2026-04-05 22:58:22','2026-03-22 23:04:41','2026-03-22 22:58:21'),(88,28,'1ca2bbb7228dd53194d88a310a6e689e1b251825dc2a3764b29b25c3dd6619d2','2026-04-05 23:04:41',NULL,'2026-03-22 23:04:41'),(89,28,'6e5c8799a9c772ac663aaafc8867acd0cf3ab69bfb8d33c2857e84756f79510c','2026-04-05 23:04:41','2026-03-22 23:04:46','2026-03-22 23:04:41'),(90,28,'08429bf13004e021a0d4c1f384e3ade8f41f1f755542fc2f4c12600145ea9cc8','2026-04-05 23:04:46','2026-03-22 23:04:46','2026-03-22 23:04:46'),(91,28,'b0424f9ab2d374b2e7a1268605adb185ba49f23983861aed8009dd79258d907e','2026-04-05 23:04:46','2026-03-22 23:28:39','2026-03-22 23:04:46'),(92,28,'50e4566d61b2d339e7c68ac1fb021a430e7b0f843778c48db68e5b312d91d706','2026-04-05 23:28:39',NULL,'2026-03-22 23:28:39'),(93,28,'a5b7312657bc4354f96ba98ff766339f4c4eb6c5b65b358b57e6462b065de07e','2026-04-05 23:28:39','2026-03-22 23:28:39','2026-03-22 23:28:39'),(94,28,'25e1219af6f32dc1def940551d537737c8f11fcfef8870b963ffab130a72b664','2026-04-05 23:28:40',NULL,'2026-03-22 23:28:39'),(95,29,'b44d55e3fbe515e4123ec4d35a2fe3be8f4321e98d7dd29a4132aa25a1983b41','2026-04-05 23:30:19','2026-03-22 23:50:18','2026-03-22 23:30:18'),(96,29,'7df36332cc351085f9752e8bed1516dd5b4b6a1898f9a4a869857dd7402e258f','2026-04-05 23:50:19','2026-03-22 23:50:18','2026-03-22 23:50:18'),(97,29,'58d658dd2cff331d6203a4ca07d0b9ba845909fbb58adad7a24355e484d9c1d3','2026-04-05 23:50:19',NULL,'2026-03-22 23:50:18'),(98,29,'3b47be8df9f8ff6e354a852739d38b34721844f34a98d63b91512d764dc88459','2026-04-05 23:50:19',NULL,'2026-03-22 23:50:18'),(99,29,'8bb65f8efa40928768e6a665223b5a9cf8a6943dcb3d6333b3efaba87df690ff','2026-04-05 23:50:19','2026-03-22 23:50:18','2026-03-22 23:50:18'),(100,29,'218b7e2d3f326c56b7ba7c9e7fe58c174eff54ff489ad15bb2d28e3670aad284','2026-04-05 23:50:19','2026-03-22 23:50:18','2026-03-22 23:50:18'),(101,29,'0043c4d48f3672ee56d3db4dcd852383ad76d6a6c2cf4dc06c5e9eaac1a688fb','2026-04-05 23:50:19','2026-03-22 23:50:19','2026-03-22 23:50:18'),(102,29,'0ce8788aa86d1498479798a52fef00ceddf56fd8e2698f64ce02f855a33084e6','2026-04-05 23:50:19','2026-03-23 00:32:58','2026-03-22 23:50:19'),(103,29,'011471c962d1253bf7f85e00253db813b562a1acdfaeb04152a6bb8b7e13f902','2026-04-06 00:32:58','2026-03-23 00:51:02','2026-03-23 00:32:58'),(104,29,'29743a6e7d7ab5d5aae14bf0761db7116e650d6d4e4760ccfab6910b581ec257','2026-04-06 00:51:02',NULL,'2026-03-23 00:51:02'),(105,29,'b6fefe8dc5e3117564c093c254171bf37d14759c8f6b5d17460b8b16fc74f7c0','2026-04-06 00:51:02','2026-03-23 00:51:19','2026-03-23 00:51:02'),(106,29,'6d2ece4c5060d0f9d0b2978b5c720e5e37bc40b377ce0ec37b4b5da8628d61fc','2026-04-06 00:51:20','2026-03-23 00:51:19','2026-03-23 00:51:19'),(107,29,'0e15ef6b9d4ac89e787d4deb4ad8087d2f7af3db3308df0e29235bc9642ce55f','2026-04-06 00:51:20','2026-03-23 00:51:51','2026-03-23 00:51:19'),(108,29,'a2bed61faebeb23f0df676cf4c74f537b3817c5cea43a45c1b2bf86b9b7966c4','2026-04-06 00:51:51','2026-03-23 07:44:14','2026-03-23 00:51:51'),(109,29,'6d952508611b6a6c7720c333655c5fe7640982e5e7c7d18fc00e910fe6d1a12b','2026-04-06 07:44:14',NULL,'2026-03-23 07:44:14'),(110,28,'3fc4d536d150ad30f2508edbae7778133ab61cf3deac361d79d825465f18cb9e','2026-04-06 07:52:05','2026-03-23 08:27:10','2026-03-23 07:52:04'),(111,28,'7645b93a8a83eb7336d4930261193cdff983ed6c4cd6b0fc050653889f4e7087','2026-04-06 08:27:10','2026-03-23 08:43:13','2026-03-23 08:27:10'),(112,28,'29971bbf751f0954c2407828e91c7c698bfa9979e097f508d4f3903bdf7931ea','2026-04-06 08:43:14','2026-03-23 09:13:15','2026-03-23 08:43:13'),(113,28,'5ba16c502608a1a89b7e458667b4a67acd575955ff01070411fe91d8c29690a4','2026-04-06 09:13:15','2026-03-23 09:38:25','2026-03-23 09:13:15'),(114,28,'03babb24d070d18b194df8ded451fe11a9381e66439e36ef6dc0f5ac1bb1803e','2026-04-06 09:38:26','2026-03-23 10:03:03','2026-03-23 09:38:25'),(115,28,'d42d00ba8ecb74777dd4304466602129aedf1e784595d071453d160b341daff6','2026-04-06 10:03:03','2026-03-23 10:29:04','2026-03-23 10:03:03'),(116,28,'c416c06634bb50b873caf9c92a32b1ed1cb8a4c5145a1860e8c5abe21758cc8e','2026-04-06 10:29:04',NULL,'2026-03-23 10:29:04'),(117,28,'d9094b7951886f6ffc1bb24202a53c4a825f01f33874dc52a3fe13b332b807b0','2026-04-06 10:29:21','2026-03-23 10:29:41','2026-03-23 10:29:20'),(118,28,'65a13d9250a4d1e08b06b64381c82f66e5e2ea071a896caf52eec52d37a7b94d','2026-04-06 10:29:42','2026-03-23 10:29:44','2026-03-23 10:29:41'),(119,28,'8d6a1452a9923abbc94c3ca3a772979fe35f888af47c71335d2c03b2888f990b','2026-04-06 10:29:44','2026-03-23 10:29:45','2026-03-23 10:29:44'),(120,28,'2cba991dd45963bd9c05d36b940446b7e2a0d0dc2e84c2713d3084368d344156','2026-04-06 10:29:45','2026-03-23 10:30:53','2026-03-23 10:29:45'),(121,28,'9747c941fdd6bfa1cc48d7a6cb99300f8d60c587befdb397ff670d226e90323b','2026-04-06 10:30:53','2026-03-23 10:30:55','2026-03-23 10:30:53'),(122,28,'e3d48990ca5624c76cd97b39c4a17209a600bc4aed541a1083698c3515eddfab','2026-04-06 10:30:56','2026-03-23 10:31:07','2026-03-23 10:30:55'),(123,28,'6b415594d494e19f28fee4e398848bae89c1c0022081def9e5edb31f25df4ced','2026-04-06 10:31:07','2026-03-23 10:31:08','2026-03-23 10:31:07'),(124,28,'1fb90586f33cdee65f52c9a7de72be96a8cfe3343535e1f8b656d7568dc5be39','2026-04-06 10:31:08','2026-03-23 10:31:16','2026-03-23 10:31:08'),(125,28,'b17e0c06645cc8875218057a735c2c41511605341ef8c33dc3c0b361c2c4034a','2026-04-06 10:31:17','2026-03-23 10:31:18','2026-03-23 10:31:16'),(126,28,'75060f87dd09a611896cac8877989f47d5f31829762dc8432b542df20e78735d','2026-04-06 10:31:18','2026-03-23 10:31:21','2026-03-23 10:31:18'),(127,28,'0fa023a387cafbbe27ad1caf1731db6515c914c83b5b3ea1d2bf533cbf07a56a','2026-04-06 10:31:21','2026-03-23 10:31:22','2026-03-23 10:31:21'),(128,28,'d6b60570e149c3b49cba9d248f8390250fcb81bd1cd7b9b5a3b3a440d66d8223','2026-04-06 10:31:23','2026-03-23 10:31:32','2026-03-23 10:31:22'),(129,28,'7a1453b952ce3b520bb4e6b2434ab422874af96cc0d0a5bfe0862dd87491b0dd','2026-04-06 10:31:33','2026-03-23 10:31:34','2026-03-23 10:31:32'),(130,28,'d571e84a1fa5bfc9307f113b187809fa55cba4d83744e04281d2ead6260f7902','2026-04-06 10:31:35','2026-03-23 10:31:37','2026-03-23 10:31:34'),(131,28,'ef7182db69cd942d9cb5a41d19553d94060cd16f16160c1621a02166b6ec9ce7','2026-04-06 10:31:37','2026-03-23 10:31:39','2026-03-23 10:31:37'),(132,28,'568166d7a8c6a04964b7cc7faed703e6e46d060367c2007443758d584228865c','2026-04-06 10:31:40','2026-03-23 10:49:28','2026-03-23 10:31:39'),(133,28,'adf62fd5be1cba8622d753520174bc30467d077796c54dcd9c982dde5d6d50a9','2026-04-06 10:49:28',NULL,'2026-03-23 10:49:28'),(134,28,'93035fb27197fe4645a7019c8ec381c5adc57599bf28c1371e5040e7fd8cbf60','2026-04-06 10:49:28','2026-03-23 10:49:34','2026-03-23 10:49:28'),(135,28,'f9950fc7c0a99260cc9394a0cac157020fedb4adfe82001871eff4315415c0e0','2026-04-06 10:49:34','2026-03-23 10:49:36','2026-03-23 10:49:34'),(136,28,'3debb3da0d4d8421e9c1583e9dcc50a6e3c7ce5ebcbd39728c9106839f119ec1','2026-04-06 10:49:36','2026-03-23 10:49:40','2026-03-23 10:49:36'),(137,28,'3458f2c68cf59ea7bb9354899249fb0b1b54e6d221ca53320d061262b40cb5e3','2026-04-06 10:49:40','2026-03-23 11:14:39','2026-03-23 10:49:40'),(138,28,'5cdc5221750c5948cc4879a3497f18820596bd0dc605ff9db2f0be4726dc0e01','2026-04-06 11:14:40','2026-03-23 11:41:07','2026-03-23 11:14:39'),(139,28,'d8d22bd00aaf5a5596eeb82816770552949c61b15d031682a54c224d3fefd859','2026-04-06 11:14:40',NULL,'2026-03-23 11:14:39'),(140,28,'f18b4efa3312bf41264f9cfc9db745c9c60bcc21bfb141daf044881b5e5bc373','2026-04-06 11:41:07','2026-03-23 11:48:38','2026-03-23 11:41:07'),(141,28,'1fe1cf51a07d230e9725279b628acdc39e11b1b89438fe5f2d1a3b15e7f24438','2026-04-06 11:48:39','2026-03-23 12:10:11','2026-03-23 11:48:38'),(142,28,'da38f05610e7103f0a89b65b67159d36be4a98c1b08cb861080b60f436aacda3','2026-04-06 12:10:12','2026-03-23 12:13:26','2026-03-23 12:10:11'),(143,28,'251af7e804064d81aa7c62ba71440b8d1a00d64d866fe6d38b599abf6f30b60f','2026-04-06 12:13:27','2026-03-23 12:29:44','2026-03-23 12:13:27'),(144,28,'72e7a5474452c5b1f2f975665499a439c485d9c6154caa23943462dc22d50de2','2026-04-06 12:29:45','2026-03-23 12:33:01','2026-03-23 12:29:44'),(145,28,'5f2f3630fec46fa4ba20331a2a4814edf500934ac81f99508cc3801b2d1ea885','2026-04-06 12:33:02',NULL,'2026-03-23 12:33:01'),(146,29,'992eebff7d7c9c798d7524e8616cda17c20bc628b2b938b6501047b8f5e78868','2026-04-06 12:34:29','2026-03-23 12:36:27','2026-03-23 12:34:29'),(147,29,'e7843e3471832d214d9437ddf5b1d5e826e00d58f37d54e2f6ef476fe93d19db','2026-04-06 12:36:27','2026-03-23 13:00:36','2026-03-23 12:36:27'),(148,29,'57ea5cbbcdb8d7a25edba9cdf74e7705dd6d11dedcc4fda8d071002a310ed540','2026-04-06 13:00:37','2026-03-23 13:42:34','2026-03-23 13:00:36'),(149,29,'db00d52d5a34bebff83a1fd8c44fd2d8197a6ae9933033a5b6eab76517090286','2026-04-06 13:42:35','2026-03-23 13:58:43','2026-03-23 13:42:34'),(150,29,'355d64c0da50bdb9f1f443d67650e257768d99136dc699cb5b9a8d99cf0a1f28','2026-04-06 13:58:43','2026-03-23 13:58:43','2026-03-23 13:58:43'),(151,29,'3df775883005b815cb216d92a73fba0d93b4fe8881da5e0cc1f5d9fb3892046d','2026-04-06 13:58:43','2026-03-23 13:58:43','2026-03-23 13:58:43'),(152,29,'5ecd612e9c2df839ec858f276a1763bb6361b95f72e21ef51a3fbb37c28e7ae1','2026-04-06 13:58:44','2026-03-23 13:58:43','2026-03-23 13:58:43'),(153,29,'98b45034c729b09ecc6c5b008754e0035942f72987dfe41b54571c12070c7d36','2026-04-06 13:58:44','2026-03-23 13:58:43','2026-03-23 13:58:43'),(154,29,'85c9370507f60dcd6234258d50bcf337db4bbbaf0f744a12c749e5c754f91ca6','2026-04-06 13:58:44','2026-03-23 14:12:13','2026-03-23 13:58:43'),(155,29,'8d1b94333768f0ae8eb7a7748dfa754231316e1686375110e1f785b616a5075c','2026-04-06 14:12:14','2026-03-23 14:13:52','2026-03-23 14:12:13'),(156,29,'a2c6eff3335c662e3f607316b912beb53469cef297909dffeb0a70c435db00b7','2026-04-06 14:13:53','2026-03-23 14:32:18','2026-03-23 14:13:52'),(157,29,'733354b5383dabbf44f4fd62ad563a809a64e1822df2a4f9ce95eecf9109bda8','2026-04-06 14:32:18','2026-03-23 14:32:25','2026-03-23 14:32:18'),(158,29,'23efc513fc87c3d9635ab8a8be19f05dc7057c3802c023534d1bd9463dda2c06','2026-04-06 14:32:25','2026-03-23 14:51:18','2026-03-23 14:32:25'),(159,29,'8fabf334106ad3a936010cf614ccc85274cfd9fdfbf323a1cf4b65a5cf4cdff2','2026-04-06 14:51:18','2026-03-23 14:51:59','2026-03-23 14:51:18'),(160,29,'cb599a62576049ef2f8b28e2df2c0d6f8c2429db01fb970e0a0add1873a7c6c9','2026-04-06 14:52:00','2026-03-23 15:08:42','2026-03-23 14:51:59'),(161,29,'f76c5d0d5991b65b60c2b56356290026b75f1ffeb046b87d738f8d31cd2a14f4','2026-04-06 15:08:42','2026-03-23 15:22:38','2026-03-23 15:08:42'),(162,29,'aff366f24e36bf501fb66bccca9c980df05757d0f444c8746b7ec1954b669bd0','2026-04-06 15:22:38','2026-03-23 15:37:51','2026-03-23 15:22:38'),(163,29,'cd252b9fe622731e3889834de7f5247ad981c3d932ed776a0d96b616af5664b1','2026-04-06 15:37:52','2026-03-23 15:38:19','2026-03-23 15:37:51'),(164,29,'86acb82eac4e567f3be9da429deb47aa4dfa30675165c5615eae691ed4992d84','2026-04-06 15:38:20','2026-03-23 16:03:03','2026-03-23 15:38:19'),(165,29,'39435d365c3393142ee2414e7c00a71133afa8b11a2dcd1d113551c7029e7c1b','2026-04-06 16:03:04','2026-03-23 16:03:06','2026-03-23 16:03:04'),(166,29,'3fca2e10d9d0a87e3eabb19f5fec7c6cfd02fd894dcf985230ecacfade4185f7','2026-04-06 16:03:07','2026-03-23 16:03:29','2026-03-23 16:03:06'),(167,29,'5645964ffb8279d54c65c7a9b3ad06ceb0ec1cfe2beb19d1b044800f22e632f5','2026-04-06 16:03:30','2026-03-23 17:31:44','2026-03-23 16:03:29'),(168,29,'3177fa8bfb0b9c63e7b394e94bdab7ebd6e541b92e8ccc2295da75e3a65c6734','2026-04-06 17:31:45',NULL,'2026-03-23 17:31:44'),(169,29,'c1b86939f04cbd46feabe6f2b1d8bdfd4c01ebc659d8d6362a57a676a79d40e9','2026-04-06 17:32:09','2026-03-23 17:32:27','2026-03-23 17:32:09'),(170,29,'1d7af7447d14bdd145204bde0ceac90b4fd2f344e8e0fa41e6a4865cabf966d6','2026-04-06 17:32:27','2026-03-23 17:32:47','2026-03-23 17:32:27'),(171,29,'4e71d3fb59bbf17bc9eb3790a7280b026f55eca803fa94192b96ec3398938d7d','2026-04-06 17:32:48','2026-03-23 17:52:18','2026-03-23 17:32:47'),(172,29,'cefc110a5f5b935126bb558da22b2f2f7ad1b5641e53cc745a48661170456238','2026-04-06 17:52:18',NULL,'2026-03-23 17:52:18'),(173,29,'18641a386bc12058e59f673dfa9a6a878fdc6b3119958ab078a561d5dab210c3','2026-04-06 17:52:18','2026-03-23 17:52:19','2026-03-23 17:52:18'),(174,29,'be65c9e059b1862397783c7bd366b336201de835524da72548a5d515ca6802c2','2026-04-06 17:52:20','2026-03-23 18:24:24','2026-03-23 17:52:19'),(175,29,'9e5a45097962f6c694665480889ad5b86d73246b5d883e8ee20c0fcfe6b6d906','2026-04-06 18:24:25',NULL,'2026-03-23 18:24:24'),(176,29,'c357145ef3639f35a3a72dedff5f5159150aa706f4a0bf8d689f8a35c683173d','2026-04-06 18:59:29','2026-03-23 19:14:32','2026-03-23 18:59:29'),(177,29,'fe088e9836bf5e0a597797d3c5cb5eaf3b7f0645664ee113c3920d809e494dac','2026-04-06 19:14:32','2026-03-23 19:14:51','2026-03-23 19:14:32'),(178,29,'afd65f597ad539f1530f63e6794fbef827d64dc08293882ac1607fa6f3201fda','2026-04-06 19:14:52','2026-03-23 19:35:48','2026-03-23 19:14:51'),(179,29,'e31482ce1b2a4251379e7e6534fd6fc57494ce5333aa05c49f15bec6d80cf5e4','2026-04-06 19:35:49','2026-03-23 19:38:50','2026-03-23 19:35:48'),(180,29,'9113fd667b47aa96e68651cf513d319cd5bdfb168521f480b5d8b80ac1111407','2026-04-06 19:38:50','2026-03-23 19:39:01','2026-03-23 19:38:50'),(181,29,'36f79c94e1abb2c9f7edcefc74bfbeb73645ab30bce4ec29a79be25919e360d0','2026-04-06 19:39:02',NULL,'2026-03-23 19:39:01'),(182,33,'40bf142b8986702dee9d98ef4f1f766b88e297750236a93d3c670124da6a7576','2026-04-06 19:42:10','2026-03-23 19:44:52','2026-03-23 19:42:09'),(183,33,'63efb890b2c476e72c16e72a02b8cf34122f0566f6e85abd8bfc84279fa35edd','2026-04-06 19:44:53','2026-03-23 19:44:52','2026-03-23 19:44:52'),(184,33,'df14e525fb2e77f827cfbc9a106cfb735f8584f84ed0c87ace07c05081bdc6df','2026-04-06 19:44:53','2026-03-23 19:44:55','2026-03-23 19:44:52'),(185,33,'7af3b77f3dbd5c52577836bbdea7c711240992cbe407a34c8eba1f408316eb7f','2026-04-06 19:44:55','2026-03-23 19:44:55','2026-03-23 19:44:55'),(186,33,'187aa2c323c7aac2233d8673d611b8ff971a64221ff61ca650f94647163e3744','2026-04-06 19:44:56',NULL,'2026-03-23 19:44:55'),(187,29,'20c205fa172c6034febbee2ff4bc79b4afb619c80a1045d4afd62482790eeacc','2026-04-06 19:47:37','2026-03-23 19:48:51','2026-03-23 19:47:36'),(188,29,'bf58b748856ed5028c67647e1fae4dd2e34eaf4253c69c0690b81af3541da3ff','2026-04-06 19:48:51','2026-03-23 20:23:49','2026-03-23 19:48:51'),(189,29,'52cf8603a03825f7e4873d9bc223d864cd07908aef57857d93af491b81e6b9e0','2026-04-06 20:23:50','2026-03-23 20:23:50','2026-03-23 20:23:49'),(190,29,'ee2a1ed82226d0c44a8e41a5c5c67975d5cdaff61e72540ec2cb76a605d33e11','2026-04-06 20:23:50','2026-03-23 20:23:50','2026-03-23 20:23:50'),(191,29,'383653bff431c71337bd8ec67ded176b05378aaa66bf9c0292526c2c1c19caa4','2026-04-06 20:23:50','2026-03-23 20:44:00','2026-03-23 20:23:50'),(192,29,'3af59103786db0b0635bafa7e3b14f51c372d88f4897b432c24b4a5a6c9ecdde','2026-04-06 20:44:00','2026-03-23 20:46:59','2026-03-23 20:44:00'),(193,29,'2d20106607f81109dc70f171158cc9fa06663ad6716d285a00113fb89a7fa3d6','2026-04-06 20:46:59','2026-03-23 20:47:02','2026-03-23 20:46:59'),(194,29,'c3b0431a53a6ee16353a05f8128e29a6d07b967aa67c1c4a0bb428924ba60923','2026-04-06 20:47:03','2026-03-23 21:13:33','2026-03-23 20:47:02'),(195,29,'c367ccd409d1aebf571f08ae2f7b938a796e5f0f5be4627c43fcaddeecd8ad80','2026-04-06 21:13:33','2026-03-23 21:13:41','2026-03-23 21:13:33'),(196,29,'08b4ffad4fd3b92fb36896f09c8e76861339a568dee7df07c7e476e248b924aa','2026-04-06 21:13:41','2026-03-23 21:13:43','2026-03-23 21:13:41'),(197,29,'1434d6b635c1ea25fa63b04604b352909bfc4684b51d490b59c71e1798fb2608','2026-04-06 21:13:43','2026-03-23 21:13:43','2026-03-23 21:13:43'),(198,29,'e29bed2ee250d41a7ab7fb6e9f52f22202a811c0b97d886e3804250e588bf7ff','2026-04-06 21:13:43','2026-03-23 21:13:43','2026-03-23 21:13:43'),(199,29,'5b31d9b6f16bf0b669204f4ee298a0c34aeb1715fdce6f201fddf7741b1157d6','2026-04-06 21:13:44','2026-03-23 21:39:09','2026-03-23 21:13:43'),(200,29,'17e0bb1343c85b6eccf5df4b487a99623b96e9a02ad43af829bb64be0f275e1b','2026-04-06 21:39:09',NULL,'2026-03-23 21:39:09'),(201,29,'a3b87ca473194e8d34a07896763671368acba7c586228fa36213ab934d87f2c6','2026-04-06 21:39:09','2026-03-23 22:13:14','2026-03-23 21:39:09'),(202,29,'0468f167147c4f57041ef6cd3057748947354ee8ee724d763cbe98ec445583d9','2026-04-06 22:13:14','2026-03-23 22:13:14','2026-03-23 22:13:14'),(203,29,'267a2db25976fbea5caa251a405779bbbfbc0b96962c2f6589cd8750b3fc5cad','2026-04-06 22:13:14','2026-03-23 22:13:14','2026-03-23 22:13:14'),(204,29,'bf67f3d3b97f9bbd2101d3d8270f8d867da7b77e55fc6c41ee1edcfb84b9dd7f','2026-04-06 22:13:14','2026-03-23 22:14:03','2026-03-23 22:13:14'),(205,29,'4811d6c60346b8821daf4230137863a1a86aabd4bca65341b632f44e169c7411','2026-04-06 22:14:04','2026-03-23 22:14:08','2026-03-23 22:14:03'),(206,29,'f28052b4a1cfa5cce9b893632641d0ecefaf2e60188244b60523f11f8fb602bc','2026-04-06 22:14:08','2026-03-23 22:26:41','2026-03-23 22:14:08'),(207,29,'3d8ef90c88846d1eb2796e984ba3fd5400323227347393eed25d799983e0406e','2026-04-06 22:26:41','2026-03-23 22:27:17','2026-03-23 22:26:41'),(208,29,'623d35c729478129abd1b6e5a7d232ccb5963deafacd2a20f1f94c64235a5cf4','2026-04-06 22:27:17','2026-03-23 22:39:31','2026-03-23 22:27:17'),(209,29,'bf33e7a978a4f2824771e2b099676813a52b31c4b65fab0ec11006631805d928','2026-04-06 22:39:31','2026-03-23 22:39:40','2026-03-23 22:39:31'),(210,29,'b3c8b9512ff352fb4e53e67b9909eb1f7e7e24be1b4793952978cc8c8870694e','2026-04-06 22:39:41','2026-03-24 07:06:22','2026-03-23 22:39:40'),(211,29,'068bc3223fb385b7485e29a7a1acc490bb3992118bb8c615fe7f2d95c9cf74a2','2026-04-07 07:06:23',NULL,'2026-03-24 07:06:23'),(212,29,'1070bc64b7d16b11e2e597e141868c415b2cd9e833be73d384edac385bd13eb9','2026-04-07 07:06:23','2026-03-24 07:06:25','2026-03-24 07:06:23'),(213,29,'9b12629caa9b519207cefc63796443b922635495e27886fec02ee6ef44d3061d','2026-04-07 07:06:25','2026-03-24 07:22:05','2026-03-24 07:06:25'),(214,29,'6735f718abc7117a6c2280ac4ea0a33a50fe7503487d00e7498ac47babd71e76','2026-04-07 07:22:05','2026-03-24 07:22:13','2026-03-24 07:22:05'),(215,29,'9597cd903a33cd2f67e57b93e366fde4865907027e8cc97e8058231885d8991c','2026-04-07 07:22:14','2026-03-24 07:22:20','2026-03-24 07:22:13'),(216,29,'2dd9bd87f1673e9507419b5dedcd76997348b3d6d401104c4a331cf53e01912d','2026-04-07 07:22:20','2026-03-24 07:29:42','2026-03-24 07:22:20'),(217,29,'e844d5aa8f9f3c14bed3b94e203492b4f29dd040c2015860a3e6b9b4fde27129','2026-04-07 07:29:43','2026-03-24 07:35:30','2026-03-24 07:29:42'),(218,29,'0a743d965a29f919fe1ab97f2df9d6aaa732f81872787d4b77dd7fafd9179b42','2026-04-07 07:35:31',NULL,'2026-03-24 07:35:30'),(219,2,'17911f846a6525dc65e733ba440d9cef5120690267a6c8de7f2a1efbb645c399','2026-04-07 07:36:55','2026-03-24 07:57:56','2026-03-24 07:36:54'),(220,2,'2be2109ebe8ffb8e9d65a6391b019ab77ae41c440710043c719985b3c5c0a1ce','2026-04-07 07:57:57','2026-03-24 07:58:40','2026-03-24 07:57:56'),(221,2,'6caf7efd5b1ac19b1ea57284491d047bea0e38438918a8a2749f9b997ac373ab','2026-04-07 07:58:41','2026-03-24 07:58:45','2026-03-24 07:58:40'),(222,2,'7a6ad0782e5e4b1354d8b85da2aa21c041d7eae19cb89440ba513e0239886927','2026-04-07 07:58:45','2026-03-24 08:00:23','2026-03-24 07:58:45'),(223,2,'ce283ced9ce82386c12a435ad95b64061119918eac4ff72f5894e391382042ed','2026-04-07 08:00:23',NULL,'2026-03-24 08:00:23'),(224,29,'b164202e2feff8170af58ca393c609eff155aad29c5d3294c930fe3d2e975a71','2026-04-07 08:01:51',NULL,'2026-03-24 08:01:50'),(225,29,'ff7eb63fa15848608a7bf39b0ac5fedaac6f41d3aa7bf163671cd35950da3d3d','2026-04-07 08:02:44',NULL,'2026-03-24 08:02:43'),(226,29,'29d4703ba95e76863926bba5fce0cd6ea3cf95a0397b4c9471dbba51aad2b1f6','2026-04-07 08:03:49',NULL,'2026-03-24 08:03:48'),(227,29,'b7433f38ed59516757d85ce739b1221516c9b07fd4f2a46c56c7ffa31927dd46','2026-04-07 08:12:42',NULL,'2026-03-24 08:12:42'),(228,29,'914547e523e806a290a7696ae21e6f4b91f3f0ab949ba0634ae45638d65731ce','2026-04-07 08:13:36',NULL,'2026-03-24 08:13:36'),(229,28,'14cc33d786612e3cd56f228cac82b77e05be61e7a67053b8ab3e342b79064e8f','2026-04-07 08:25:37',NULL,'2026-03-24 08:25:36'),(230,29,'08b6d655167381410b884bbfeb6b7c3a5018c5521d403a18796e63f6d2aa6fb1','2026-04-07 08:44:54','2026-03-24 08:51:51','2026-03-24 08:44:54'),(231,29,'b3aabfd3c59d8d5d2a2e37d8deb40c489823634ce4994ef140f538e1936412e8','2026-04-07 08:51:51','2026-03-24 08:51:56','2026-03-24 08:51:51'),(232,29,'ae3b2f5604eab69568a9698e06f3d161afebce05306170b12650dd6853e2b2d1','2026-04-07 08:51:56',NULL,'2026-03-24 08:51:56'),(233,29,'a00ff5adf79b958eed91e195027d37cffa9206f31f95f40219ebe2c51aa1d40c','2026-04-07 09:33:54',NULL,'2026-03-24 09:33:53'),(234,29,'e2484c5a6bfa4599359c3f572d4400e58f2b2d367e81d4d1e70f3f0840acdd73','2026-04-07 10:02:04',NULL,'2026-03-24 10:02:04'),(235,28,'b724cd5c79d40a747ea9717c6632ca96cb2a5be7ed8834655ad82d079f1948c7','2026-04-07 10:02:54',NULL,'2026-03-24 10:02:53'),(236,2,'6d5e450045e293eb97142f96ce1ad25ad0059ac7fdff4426d989297c2f73a0dd','2026-04-07 10:08:20','2026-03-24 10:24:42','2026-03-24 10:08:19'),(237,2,'92f0f6bd2a21807a731e63bef1293d3057048cc07c0d839024792cea41b5783b','2026-04-07 10:24:43','2026-03-24 10:24:42','2026-03-24 10:24:42'),(238,2,'bd68b2513316e36a9bfa04178325be966fd40cd5f74a0fa645bdf6e7061aadcb','2026-04-07 10:24:43','2026-03-24 10:24:42','2026-03-24 10:24:42'),(239,2,'826b11450c9f821767490b3bb6418c61308f0c9399d8e40a35496c14a4380793','2026-04-07 10:24:43','2026-03-24 10:24:42','2026-03-24 10:24:42'),(240,2,'98c54b043390dc49a098b76f1dde7317c357cd22657a1b093c228908fa1b5e47','2026-04-07 10:24:43','2026-03-24 10:24:45','2026-03-24 10:24:42'),(241,2,'55d532bbc139ac7f9a18ab478d7b1cf97af23b0976283184153a2a7472246ea0','2026-04-07 10:24:45','2026-03-24 10:24:45','2026-03-24 10:24:45'),(242,2,'24cd9305b6b4ef1e81db8310b1466bf909277aafbe363f6660c414797b144d03','2026-04-07 10:24:45','2026-03-24 10:24:45','2026-03-24 10:24:45'),(243,2,'f15ab92041eacbbb97a349b8496c70fff4a6476b8da54aa58378d0a8c46fe6a3','2026-04-07 10:24:45','2026-03-24 10:24:49','2026-03-24 10:24:45'),(244,2,'3ed531984aaf4dc929e3fda52158b52605adb20a093e343852ad28492091732d','2026-04-07 10:24:49','2026-03-24 10:24:49','2026-03-24 10:24:49'),(245,2,'c5a0d62562b7c39ba474c1369314fba08b205907f937a541f9f894678ad81a4c','2026-04-07 10:24:49','2026-03-24 10:24:49','2026-03-24 10:24:49'),(246,2,'1f1550117622ee0143d9a4f75a864a29db545aea3b2934eef602cf2803b271b7','2026-04-07 10:24:49',NULL,'2026-03-24 10:24:49'),(247,28,'2ced429fd2ff63dcd085c6879f38c59c996865bf50c5c70490175676694e621a','2026-04-07 10:26:14',NULL,'2026-03-24 10:26:14'),(248,29,'7db9f94936644b96ddd5cd4022da716862acb7418df274dbc8bbcad1546af8e7','2026-04-07 10:26:53','2026-03-24 10:27:39','2026-03-24 10:26:53'),(249,29,'d3d0751a6cbdfe2c36209288489625d3525161154c4facace354c139989c4686','2026-04-07 10:27:40','2026-03-24 10:28:06','2026-03-24 10:27:39'),(250,29,'8b153704fb2f110e4d6557c72e15ba1b1106a830f64d612828d57615c8914fd1','2026-04-07 10:28:06','2026-03-24 10:52:20','2026-03-24 10:28:06'),(251,29,'89733b1a1069eadf9c86c37bd2fd41dd2e6a38e87e498d7f015a2a16fc2457e5','2026-04-07 10:52:21','2026-03-24 11:01:43','2026-03-24 10:52:20'),(252,29,'7ee20731c4d82ec9aab9d56c29b1860d3c6fa1c83df53bf41185db796c32823a','2026-04-07 11:01:43','2026-03-24 11:02:14','2026-03-24 11:01:43'),(253,29,'3feb33a8ef30102c71f432739978996bdaa6d69f5e412e62bb264231d5557bde','2026-04-07 11:02:14','2026-03-24 11:02:15','2026-03-24 11:02:14'),(254,29,'bdf13768c20a2634dc3fb17f9a7b972dbda0e9764310d7a0f752006eddb25c2a','2026-04-07 11:02:15','2026-03-24 11:02:48','2026-03-24 11:02:15'),(255,29,'8ac4ebdeb916475612817b96d97fe8163c6a19ad226f01fea8831476e6cc5ebf','2026-04-07 11:02:48','2026-03-24 11:06:16','2026-03-24 11:02:48'),(256,29,'3a85f8bcd671cd1a42fdc783f7c62729a97cbc50f8ef0cae025503fb2846c809','2026-04-07 11:06:17',NULL,'2026-03-24 11:06:16'),(257,2,'6c4fa3100a236b599f286c69c3680e89771d9e44b0b4c485a02cf8c77a70a933','2026-04-07 11:06:36',NULL,'2026-03-24 11:06:36'),(258,2,'eb5e5803ad6ed7f467a72c7b0e699824514af5d1e9d9147bd4a9965454f31ed4','2026-04-07 11:10:26','2026-03-24 11:19:10','2026-03-24 11:10:26'),(259,2,'c9bfcf32bb497bbfef91d9f4f8d14cf4888afc41b7a57e9b1f464cc2676199c4','2026-04-07 11:19:11',NULL,'2026-03-24 11:19:10'),(260,2,'ee77d85f8102c196c1a653458d036b7e07f46ec0e64485bf048fd63474642e3d','2026-04-07 11:19:28',NULL,'2026-03-24 11:19:27'),(261,2,'3d9a07b5dd3d3e4d84626bba56acf6f36464005082f31b19d486f8082b7d9967','2026-04-07 11:20:07',NULL,'2026-03-24 11:20:06'),(262,28,'3622d698aaa50afc7ba32157993e9e45bd3b99e0c940f430201bcd68962d2925','2026-04-07 11:21:01',NULL,'2026-03-24 11:21:01'),(263,2,'e3584952a2d39654fc57280eaf094ff69fa9435e29be3becbaf3d219af79bcb0','2026-04-07 11:22:14',NULL,'2026-03-24 11:22:13'),(264,2,'2d076216bb931de1c759ceea5a75fc9b580cc012b81ffb654831d28cf36a162c','2026-04-07 11:22:58','2026-03-24 11:23:07','2026-03-24 11:22:57'),(265,2,'f086de2191145be5115810d7cf1b9c8a65d5f160e25f71e159baa0d16db6db7b','2026-04-07 11:23:08','2026-03-24 11:37:29','2026-03-24 11:23:07'),(266,2,'af922a821ec022d8e3731c04009b407e2f57c62d767521b1d99ee47e82c4b835','2026-04-07 11:37:29','2026-03-24 11:38:42','2026-03-24 11:37:29'),(267,2,'045b19beb3b3db37d0c0b6a7148936175d1f00d1422f19ec59704407ffcb86dc','2026-04-07 11:38:42','2026-03-24 11:39:31','2026-03-24 11:38:42'),(268,2,'8eff4a9eaa13d8af8926af12a304c0b101fe415a7b76c5c9327c4acc0b5bf87a','2026-04-07 11:39:32','2026-03-24 11:39:32','2026-03-24 11:39:31'),(269,2,'3d143c7dc6c2d6449edb2764c88fc37a4286113092eb0c5a589a719604e88c2d','2026-04-07 11:39:33','2026-03-24 11:39:32','2026-03-24 11:39:32'),(270,2,'74fb1e751055037ae4e64ad6c3316122073c3c91eadf55dd9b653de07d2562f5','2026-04-07 11:39:33',NULL,'2026-03-24 11:39:32'),(271,28,'5899cb704f7afac951ce091e826bcbf96e94e9e0651278a1e3e2d172de105bde','2026-04-07 11:40:10',NULL,'2026-03-24 11:40:09'),(272,2,'1076db264c49f92cb745c862462a1802a2d8db769d5d5174530c3448b2bdd10f','2026-04-07 12:06:31','2026-03-24 12:07:19','2026-03-24 12:06:30'),(273,2,'b410e3f153fa25330b73328fbdd35a79a8dec63fdf3a2c234e22a778bf4c8748','2026-04-07 12:07:19','2026-03-24 12:07:19','2026-03-24 12:07:19'),(274,2,'fae2f5abe3ba321f0c462904bc9eeff4020be6af9f5a87e4539241dca3facccd','2026-04-07 12:07:19','2026-03-24 12:07:21','2026-03-24 12:07:19'),(275,2,'5da832357d8c1b3b6fb54627ab5dbface0e18958cd9b780f2893622f0fe4094c','2026-04-07 12:07:22',NULL,'2026-03-24 12:07:21'),(276,2,'61d740dc167b2a0a06bde2d7d1c5067df246f033e51d45cc191011748234c87b','2026-04-07 12:07:35',NULL,'2026-03-24 12:07:34'),(277,1,'47b01ad0dd61c68e128ecb8ecb4bd76617230667f20609acee407dff7f83f607','2026-04-07 12:08:29','2026-03-24 12:44:15','2026-03-24 12:08:29'),(278,1,'2784e20e5363cd3fc5b9f8fb032ccac7f2be29d2b22e7573f706bb0d8955a5bf','2026-04-07 12:44:16','2026-03-24 12:44:20','2026-03-24 12:44:15'),(279,1,'31d86fb4d8985c8b158e22018617426c5c6227872aa6e85dde0ec68472060bab','2026-04-07 12:44:20','2026-03-24 12:44:20','2026-03-24 12:44:20'),(280,1,'4625aa6766b876ef6f2011843acde7b1afcb482350db36e09ccd498532123193','2026-04-07 12:44:20','2026-03-24 12:47:32','2026-03-24 12:44:20'),(281,1,'cb5c864f258aed57a011d2c46a6e3cf5f16540705a6367a1d6b7ae9329090008','2026-04-07 12:47:32',NULL,'2026-03-24 12:47:32'),(282,1,'097ace8a41a2dfe8356cda1fa0844ca70b81c26de50bc45993e36b5decbfc191','2026-04-07 12:48:11','2026-03-24 12:56:45','2026-03-24 12:48:10'),(283,1,'21b080f3e9e8d32ca3a60389f0f8d488067e1f40f3e23c90c4bc93c1b1b6814f','2026-04-07 12:56:45','2026-03-24 12:56:52','2026-03-24 12:56:45'),(284,1,'7ecaa8b261579e826f3066e98473b40f97c1b4799558c5536b47a33b8fdb275b','2026-04-07 12:56:52','2026-03-24 13:02:14','2026-03-24 12:56:52'),(285,1,'95120e969cf0c53f5f33089b483d280f313a90d996cc8c05ea5c139edb917ab7','2026-04-07 13:02:15','2026-03-24 13:02:14','2026-03-24 13:02:14'),(286,1,'dca3eefa93e24920d4c8cc9140cfd317a3224ef28208768a556bf7d693079662','2026-04-07 13:02:15','2026-03-24 13:10:26','2026-03-24 13:02:14'),(287,1,'69320ab29f0d421cf5b843d990c5eb2a3bddcb9a44f05f116912b0a7de214273','2026-04-07 13:10:26','2026-03-24 13:10:26','2026-03-24 13:10:26'),(288,1,'362179e2c282a259d2398cef2bc29f0b5025e7c429f90026e8a46927bb7e6994','2026-04-07 13:10:26','2026-03-24 13:10:26','2026-03-24 13:10:26'),(289,1,'f93088d77855cb0f30e1129f8361b2afcc7889d79a72404355b55996544bb722','2026-04-07 13:10:26','2026-03-24 13:12:35','2026-03-24 13:10:26'),(290,1,'498ceacb8a32f89a9b2b53f5d6de0c8c3720e2802d41657228cf582f14ee4b08','2026-04-07 13:12:36',NULL,'2026-03-24 13:12:35'),(291,1,'302cd3cbf963cdb727ef2e29919a9f47a4c3ae7aed30c75298f780144bc60327','2026-04-07 13:12:57',NULL,'2026-03-24 13:12:56'),(292,29,'2ab5c0f66b7cc43db286a481dbedf24124e4bfdecefc2bc097baf40eed28a0d1','2026-04-07 13:13:50',NULL,'2026-03-24 13:13:49'),(293,28,'9e3d70e8d55c26b46a5ef41bd0afbc82d47d59d4c5c26419a195c555e06eb8a6','2026-04-07 13:14:09',NULL,'2026-03-24 13:14:09'),(294,33,'f7cf8204c4768f9da28900471e9f9361787a09d65cbe738b05a094799f51fca7','2026-04-07 13:15:20','2026-03-24 13:15:46','2026-03-24 13:15:20'),(295,33,'6291199b62050abfba0c7cfd588a1e4e150af40da9166f2aa633fbb0e9349c93','2026-04-07 13:15:46','2026-03-24 13:16:35','2026-03-24 13:15:46'),(296,33,'2129c6aa05b0e3f2b79b086fd9119a8511ce56ecdc24938ff78086f9fecafc76','2026-04-07 13:16:35','2026-03-24 13:16:49','2026-03-24 13:16:35'),(297,33,'973bc6dab67729259dccedbb550c2331409e44dc814feb411e409da94843b0b4','2026-04-07 13:16:49',NULL,'2026-03-24 13:16:49'),(298,2,'ec31867b709a6102a5103fce5f5a55b1770d229d955e060c3986d8c72933833e','2026-04-07 13:17:39',NULL,'2026-03-24 13:17:38'),(299,3,'4dd623dd5105105b269ec6284b886dbeb7249f242162c9972072572f888f988e','2026-04-07 13:18:45',NULL,'2026-03-24 13:18:44'),(300,1,'64520670aa7ffa4a853324782a2018319823d4fc3ec4a7f63be14f28ea6719e9','2026-04-07 13:19:26','2026-03-24 13:29:09','2026-03-24 13:19:25'),(301,1,'5b7d8e3475e1896f63dd335d794fd8d4f450b88bf60c217aa588c41ecf0b0ca7','2026-04-07 13:29:09','2026-03-24 13:29:14','2026-03-24 13:29:09'),(302,1,'8b62f32b45ae94489036b734263aaba127c3bb8e41e8f0a281a63c9347fe8534','2026-04-07 13:29:14','2026-03-24 13:29:29','2026-03-24 13:29:14'),(303,1,'2c3b107ff447af7975cef955efb7d6cb31f17fb3c79bb60a151946e60445ec0c','2026-04-07 13:29:29',NULL,'2026-03-24 13:29:29'),(304,1,'02a0851a4f05d9a7512a5ab24f9b10ca02d42e716bc53463f81338aa9e5a997c','2026-04-07 13:30:10',NULL,'2026-03-24 13:30:10'),(305,33,'2cef96293c462f5fdaacac71335d2750f19ce76423ddbb89a33cfb40a5228ec8','2026-04-07 13:30:30','2026-03-24 13:49:57','2026-03-24 13:30:29'),(306,33,'53d9a965df1668feddf0de3188de941def34864bc63f7c5838716df778a924bf','2026-04-07 13:49:57','2026-03-24 13:50:56','2026-03-24 13:49:57'),(307,33,'56d4035cf3d6b99df036543bdb430510d50aee7a605d95f1b69b7be6673b569a','2026-04-07 13:50:56',NULL,'2026-03-24 13:50:56'),(308,1,'dc8e42b9e853b341d5400e0c3bab7aee95550324642b23f388f4c41b1ac1b9fe','2026-04-07 13:51:18','2026-03-24 13:51:18','2026-03-24 13:51:18'),(309,1,'bacd4c74b8426f5eba45094603f1c8eb5bbd99f82c0c94d32c73cd7126e46765','2026-04-07 13:51:19','2026-03-24 13:51:45','2026-03-24 13:51:18'),(310,1,'5df9cbfd3e340ef00f27aeb3d04f2ca7020739bc8829189a9230f1eb9cd26d2c','2026-04-07 13:51:45','2026-03-24 13:53:59','2026-03-24 13:51:45'),(311,1,'06dddddbf55462f666c148e9a5c026624c1958d60633db99d9d061eac97ccc68','2026-04-07 13:54:00','2026-03-24 13:54:02','2026-03-24 13:53:59'),(312,1,'3aadbd1a1f1beafae3a753a67c8550e8f2265f74ee5cc2edf07181f9adcb61ba','2026-04-07 13:54:03','2026-03-24 13:54:08','2026-03-24 13:54:02'),(313,1,'eb387cc2df4c4344f7704d22b34d2b2c794dd3869fe780d0b616808d48d160be','2026-04-07 13:54:08',NULL,'2026-03-24 13:54:08'),(314,28,'91a44627a3ef99f58900c203588e42276c865cc93777e8d8027845db066af84c','2026-04-07 13:54:22','2026-03-24 13:54:22','2026-03-24 13:54:22'),(315,28,'ccd06487d3b7b062e1d37767d1206d20db8b7c163126a9b5d21bdbf63a912567','2026-04-07 13:54:23','2026-03-24 14:06:25','2026-03-24 13:54:22'),(316,28,'515ae06da6f1bef7ab5201088844fa059da7cb3a3dd235db809a24795c21ab46','2026-04-07 14:06:26','2026-03-24 14:06:37','2026-03-24 14:06:25'),(317,28,'688f57f6ebca26ae52e48ca7b16e74d17c7ee3d74ada79a85a33b011f191ef7b','2026-04-07 14:06:37','2026-03-24 14:06:44','2026-03-24 14:06:37'),(318,28,'2ebdb5b20942773f6a916caffa8b2e9dadaf1674ba324c9c311b30ed2b5b99c8','2026-04-07 14:06:45',NULL,'2026-03-24 14:06:44'),(319,29,'b31b07bde1235f8dc17c63e7060a6ddc4f52e0c54196de60e9df726d3fdf015d','2026-04-07 14:07:12','2026-03-24 14:07:11','2026-03-24 14:07:11'),(320,29,'68cff04da2ce2059c86fbe7c16744dd09cfaa0e95d9dd5955746e39689e2434f','2026-04-07 14:07:12','2026-03-24 14:07:26','2026-03-24 14:07:11'),(321,29,'14197f74e0f8c3946683486925459582ffee91818b79cc73eeb6578006f801ed','2026-04-07 14:07:26',NULL,'2026-03-24 14:07:26'),(322,33,'f2a7e89498c45026426dad6353f7d89ce41dc592f30f824b4ad025026a9abad6','2026-04-07 14:08:17','2026-03-24 14:08:17','2026-03-24 14:08:17'),(323,33,'84c568bd1951f4c2af4d706e12867fd071da6aef5180bce755f997ce888bf3c9','2026-04-07 14:08:18','2026-03-24 14:22:43','2026-03-24 14:08:17'),(324,33,'ca8956d2190d66b8dd9538b2597de5974003d6e750dc18b31091e42db1d126da','2026-04-07 14:22:44','2026-03-24 14:23:26','2026-03-24 14:22:43'),(325,33,'73d15cc5ebd94e85ce234fa8c7d77d3d347b0d052c08ab88787ef65ca6f09c8c','2026-04-07 14:23:27',NULL,'2026-03-24 14:23:26'),(326,1,'71f091121e4574f16bb10e267c63741e8111d7bc1cc8a3969eab2947fda8c72f','2026-04-07 14:23:51','2026-03-24 14:23:50','2026-03-24 14:23:50'),(327,1,'3856bce69213be237a5240eeb51448d1eac25f8fc9a02c6b538a78be5df4d2c5','2026-04-07 14:23:51','2026-03-24 14:24:01','2026-03-24 14:23:50'),(328,1,'119927f4c542b39a0afcae34402d7d41cfae58638f36f4ac70e38ecbfec484fe','2026-04-07 14:24:01','2026-03-24 14:24:09','2026-03-24 14:24:01'),(329,1,'826ba51000980ef08910201cfadee37e36a357cf499470b7fe1c5216fee8c875','2026-04-07 14:24:09','2026-03-24 14:24:15','2026-03-24 14:24:09'),(330,1,'a1fda1277b05b8360a7d60b7e747c67d944216664495209998bfd51a249d9c12','2026-04-07 14:24:16',NULL,'2026-03-24 14:24:15'),(331,28,'95e6602e6be4f3e8937c9f305509d6903d53c890c4ef0f05080901885b2411b7','2026-04-07 14:24:39','2026-03-24 14:24:38','2026-03-24 14:24:38'),(332,28,'fd1853b61299e1e60cbc507c346f432341a01ceeaba032f558c80b20438c16c8','2026-04-07 14:24:39','2026-03-24 14:25:19','2026-03-24 14:24:38'),(333,28,'f507b2f9e1060aa072adbb7d0aafe2c747eea496091ea1066a8682006e335561','2026-04-07 14:25:19',NULL,'2026-03-24 14:25:19'),(334,29,'ec7f292883bb06d63811b44e9751a0607fda804d3832cd36894c23a7cb71aafe','2026-04-07 14:25:33','2026-03-24 14:25:33','2026-03-24 14:25:33'),(335,29,'998aa04c473d3b524ddf8eb9bcedf895f47aecb2e47eb5fd3d9285d9b6076654','2026-04-07 14:25:34','2026-03-24 14:28:19','2026-03-24 14:25:33'),(336,29,'fae17f59a307703e9f6cdfb591d3d9302d67d66eb503b01fb9b9adbc4d3fbf4f','2026-04-07 14:28:19','2026-03-24 14:28:22','2026-03-24 14:28:19'),(337,29,'c238845baf150fe31a605e66d5052a87b4c178a2059e61832eb93efd207b0b82','2026-04-07 14:28:23','2026-03-24 14:34:44','2026-03-24 14:28:22'),(338,29,'5525bdcdee25e40e3533ce3629a20b7a4c783c681036d6d3d0cbb06bc5f86ba8','2026-04-07 14:34:44','2026-03-24 14:34:44','2026-03-24 14:34:44'),(339,29,'a0ed9193a821e8f81b425510da1b70da825dadeb4efb45710b1484e10ad6a57a','2026-04-07 14:34:45','2026-03-24 14:36:33','2026-03-24 14:34:44'),(340,29,'0f74e2de3e2ed61b9ecad1a8163239b4e86f63157915ef970e8e4ed6aed9084b','2026-04-07 14:36:34','2026-03-24 14:38:58','2026-03-24 14:36:33'),(341,29,'fd5ec7d3676c28f6bc50c010f02120900603f4daeb26573752577f4a5ff565a2','2026-04-07 14:38:58','2026-03-24 14:38:59','2026-03-24 14:38:58'),(342,29,'e5c1c6b3ebe6922acfefd5b19efb696d8b3230cbe0d20c5141b2ccc954a5a7d7','2026-04-07 14:39:00','2026-03-24 14:39:03','2026-03-24 14:38:59'),(343,29,'b0702e9ddca8afc856c2d9641a306d0fc8da3af768a2f1d5e983e68d50bf6423','2026-04-07 14:39:03','2026-03-24 14:39:07','2026-03-24 14:39:03'),(344,29,'c9b94f38521291e2d99f0c8a49fb0e0b0ceb1e93aea34c346f81c52d47f76653','2026-04-07 14:39:08','2026-03-24 14:39:31','2026-03-24 14:39:07'),(345,29,'cf2d891a46a27b6c4686a775ea6506f2397d60b41718e17bc154e9d4f2511d98','2026-04-07 14:39:32',NULL,'2026-03-24 14:39:31'),(346,29,'305a906a4493f7005974c8b7753a7e2dea8cc35fdf4beea9f6f6c80e6059a0fa','2026-04-07 14:39:50','2026-03-24 14:40:01','2026-03-24 14:39:50'),(347,29,'8bc754126186ad3b77b0b65be89bf037295376cc4ccda13670e1e71138742616','2026-04-07 14:40:01',NULL,'2026-03-24 14:40:01'),(348,2,'69c2716bf1ef271f2579a43749c3d8f7650d334a69339090e4744c8fefcd260e','2026-04-07 14:40:22',NULL,'2026-03-24 14:40:21'),(356,28,'6b4fa51c9fdd3480069af2f18670279eff7869d863a26bb12f4433dbe4eecbbc','2026-04-07 14:59:17','2026-03-24 14:59:32','2026-03-24 14:59:17'),(357,28,'0fa9814e911eb25a9e0efaaa2b224541c4398b80317e3b4ee2b9707ac43ec178','2026-04-07 14:59:32',NULL,'2026-03-24 14:59:32'),(358,2,'22c47b7670516bd8dd84a186b1af50139a42b87d43c29eff6a2fc3897d04464d','2026-04-07 14:59:58',NULL,'2026-03-24 14:59:57'),(359,29,'1905c6731c687f32e37eab5b10aca02f83db91def36bced9f49b8f12f7dc17f8','2026-04-07 15:00:37','2026-03-24 15:00:44','2026-03-24 15:00:37'),(360,29,'fcae66deddccb206c5de41ed823dab26bd870ea0ecaa210eedec2305fe08a38c','2026-04-07 15:00:45','2026-03-24 15:00:50','2026-03-24 15:00:44'),(361,29,'4412d0f56c237678744ac312551c5a7c7b29899ac8e4d82b4d5bde969af97463','2026-04-07 15:00:51','2026-03-24 15:00:56','2026-03-24 15:00:50'),(362,28,'2d3c739a293bbfc336ec3b80ff0782f5ae51099df313d7c137e5c3f896aa9855','2026-04-07 15:01:16','2026-03-24 15:01:26','2026-03-24 15:01:16'),(363,28,'621e6b84df7b431bcce029261d6ee32480877086a605a16bfc9d7fe38ab7c6cb','2026-04-07 15:01:26','2026-03-24 15:01:35','2026-03-24 15:01:26'),(364,28,'5282bfde8ca8b6813377c53ff3c4c5855443f6787f859659ccdfd74c01c8e211','2026-04-07 15:01:35',NULL,'2026-03-24 15:01:35'),(365,1,'7b2ce908727ecce417cfe1317ee73586b4e9c1c32cb7ca7359c045f5170779a2','2026-04-07 15:02:09',NULL,'2026-03-24 15:02:09'),(366,28,'4e4c842eda68fd802cff43684093efba0fa1034f34e5773f6627f7c90f8af184','2026-04-07 15:04:13','2026-03-24 15:16:07','2026-03-24 15:04:13'),(367,28,'ab6992a9eb5934b088476ccdc8e5746a0a15e6ad9f1118d2b14d0fcdde9f94ad','2026-04-07 15:16:08','2026-03-24 15:16:07','2026-03-24 15:16:07'),(368,28,'7f4ba74c73fce78a518dc05094390930c7021e8a526afdf896f7834de3212d4e','2026-04-07 15:16:08','2026-03-24 15:21:15','2026-03-24 15:16:07'),(369,28,'d6876516a863a20373fc1a25a374a7c2e2e37b7ac4eb9203df4efb90df026fd5','2026-04-07 15:21:16','2026-03-24 15:21:15','2026-03-24 15:21:15'),(370,28,'b7c4c1a5e24e656f4c293546492b2a4566482683f4585b87957cb95ca59f9c6d','2026-04-07 15:21:16','2026-03-24 15:22:14','2026-03-24 15:21:15'),(371,28,'a597bca790d8244172a969d1cf3269308eea54abc66f2bbab4a16be84f2722bd','2026-04-07 15:22:15','2026-03-24 15:22:42','2026-03-24 15:22:14'),(372,28,'0e3723fd3678681e62d69ff550c43130a63a5f9ce4e724cb7448e7c364eec5ec','2026-04-07 15:22:42',NULL,'2026-03-24 15:22:42'),(373,29,'7c8b473cb0eca5eca783f86bfa0f9ef7c70b36de10cc02df6c3bab657ff10226','2026-04-07 15:23:34','2026-03-24 15:27:07','2026-03-24 15:23:34'),(374,28,'c04b19505be73e26c0d2ec8d362b371b1025be63c874be4804c9e7198897cecf','2026-04-07 15:23:56','2026-03-24 15:27:26','2026-03-24 15:23:56'),(375,29,'d497255eb8461e9257d7ec25319019b8ddbc5b96fd3bf1e8c91e24abd1947bf1','2026-04-07 15:27:07','2026-03-24 15:27:09','2026-03-24 15:27:07'),(376,29,'84300e353ae2ea523ef91ebbad9235796f86c8decb3448c102ec5eacabe9760c','2026-04-07 15:27:10','2026-03-24 15:30:34','2026-03-24 15:27:09'),(377,28,'d9e3b0b800d6b199d2f964250ec064a0ee984783df3db37288bb578bce1c8f1e','2026-04-07 15:27:27',NULL,'2026-03-24 15:27:26'),(378,2,'dae60e292628e728d522fead5507ebd8604ab43a97339b7256f2e8dce50f7c6e','2026-04-07 15:28:09','2026-03-24 15:30:34','2026-03-24 15:28:09'),(379,29,'1aeaa6bd3f73bfad92f6cc8cdb8d829de62ab03152751426b55ab19f99ccad10','2026-04-07 15:30:34','2026-03-24 15:38:06','2026-03-24 15:30:34'),(380,2,'305fbff11977aec911df37c9dff1c277d1503c0afcb76350745026846084cc0a','2026-04-07 15:30:34','2026-03-24 15:38:06','2026-03-24 15:30:34'),(381,2,'cb2756ce6b4244a1b529f2fbf429ac3bdb710bda3c5046f0151346c49d98943e','2026-04-07 15:38:06','2026-03-24 15:39:17','2026-03-24 15:38:06'),(382,29,'31082098178922ca23e6519554dc27f116bf7bd93d0cd77f44939eb9c40f8227','2026-04-07 15:38:06','2026-03-24 15:39:17','2026-03-24 15:38:06'),(383,2,'94a7ed38a608746a464c3a5d24520f31c785f7d598dfc459bdd81d7290e8c8a0','2026-04-07 15:39:17','2026-03-24 15:41:11','2026-03-24 15:39:17'),(384,29,'eef95b670ff43216a84e84aa0a6ad442d7c59c32e68a6f9c87a7dc48b81f086f','2026-04-07 15:39:17','2026-03-24 15:41:11','2026-03-24 15:39:17'),(385,2,'ac3fc145b593db35eaa76bab85d8e8c4b73a9c3360337b500ca77736d4287faf','2026-04-07 15:41:11','2026-03-24 15:48:16','2026-03-24 15:41:11'),(386,29,'e594c594976990d7331d9bb3826a4e84c87d812da4ce4a001bcc7eb1a7f3a4ba','2026-04-07 15:41:11','2026-03-24 16:08:55','2026-03-24 15:41:11'),(387,2,'0217bb4dd87c0a599777e85d57deb445db4eac3373473d1eda700b1486b66c6e','2026-04-07 15:48:16','2026-03-24 15:48:18','2026-03-24 15:48:16'),(388,2,'c39469c5e3f8d8ca3989cdf147a981d78fabba32c1d62818c48d92ec267ecb33','2026-04-07 15:48:19','2026-03-24 15:48:59','2026-03-24 15:48:18'),(389,2,'0c08f96ee58737c134a57a5295e10aac65b2c190fd7bd690ff1843b60cda942e','2026-04-07 15:48:59',NULL,'2026-03-24 15:48:59'),(390,29,'2f4bf589d2a64b81e52119b668ace3c1f77acbe23f25cf7b6639c6f559e4c81d','2026-04-07 15:49:29','2026-03-24 15:50:12','2026-03-24 15:49:28'),(391,29,'b5633e3e645e0537e62f10bbbcbd0e8dc42cb4b9dad75756738b0c6be549d0a0','2026-04-07 15:50:12','2026-03-24 15:50:20','2026-03-24 15:50:12'),(392,29,'b5c6290d48ebced36e20a4db3549cdd3480c4dc81a41590ad594b223ffa06c2f','2026-04-07 15:50:20',NULL,'2026-03-24 15:50:20'),(393,28,'ab035d988bad49b6542bada06d3ec0438178f853e5f229e18cb423659d7eb340','2026-04-07 15:55:29','2026-03-24 15:55:55','2026-03-24 15:55:28'),(394,28,'4e8b4229da542a50be3ffe670cd1467e40fb1d6ee84fd6261aade2c24cb1de0d','2026-04-07 15:55:55','2026-03-24 15:56:06','2026-03-24 15:55:55'),(395,28,'8d89e5e285eda3233ddc72d21145aa27b0c625163df4a8c9f0a10232891f1a55','2026-04-07 15:56:07','2026-03-24 15:56:22','2026-03-24 15:56:06'),(396,28,'a02a54279b17738a65b84ee0a0f9ce4a05f90bebb1e6b42d645d45f1490418c4','2026-04-07 15:56:23',NULL,'2026-03-24 15:56:22'),(397,29,'8251d61d262a792ca4e7411a97f21fa8ac29c4a0da8e679d32a1aca7029d2028','2026-04-07 15:56:40','2026-03-24 15:56:42','2026-03-24 15:56:39'),(398,29,'c50107a4871c9732835af50722c4d0a50eda307508cccc50fc97917a5720b8ec','2026-04-07 15:56:42','2026-03-24 16:09:12','2026-03-24 15:56:42'),(399,29,'f6d0b6111db0bd6355387b57066b513fd506d91b62e3f70499c5153289d3079c','2026-04-07 16:08:55','2026-03-24 16:11:25','2026-03-24 16:08:55'),(400,29,'e1cbf4ee6f006daa2ddc78122c53d14f5c77e89ddd851d40e8a319fdb0a4811b','2026-04-07 16:09:13','2026-03-24 16:09:12','2026-03-24 16:09:12'),(401,29,'aaf145247824b90e5bcf88b229e2611614acd04d26297eea50a82ea9271fc9b7','2026-04-07 16:09:13','2026-03-24 16:11:25','2026-03-24 16:09:12'),(402,29,'77b19b85b6fe1c39f92459430e6cdbbd9df542e0ca0114e09cadbd11f3e134aa','2026-04-07 16:11:25','2026-03-24 16:11:25','2026-03-24 16:11:25'),(403,29,'9b0f6e77a599aac119e4083da4cafabdac6496d451f6bcc69c972b6f3150112e','2026-04-07 16:11:25','2026-03-24 16:13:26','2026-03-24 16:11:25'),(404,29,'946e85e73e82d5c8269efb229930d4d116f74ba918b580d30c5d481d4f4e6ffb','2026-04-07 16:11:26','2026-03-24 16:11:25','2026-03-24 16:11:25'),(405,29,'c308ce3f1096530581c15e014f0f826d3cc07f3e32fb059fc2e1aafae38bf66d','2026-04-07 16:11:26','2026-03-24 16:51:50','2026-03-24 16:11:25'),(406,29,'71fd29b833f2838e30f960868e612f3c850baa83e8e6726c2888fa6b7086ce43','2026-04-07 16:13:26','2026-03-24 16:13:49','2026-03-24 16:13:26'),(407,2,'38b776db243e13f7f40aa6a46adfaf7b09b8184f8c64d7b8b7ac5d987c1bb54b','2026-04-07 16:27:35','2026-03-24 16:27:41','2026-03-24 16:27:34'),(408,2,'4d1c89dbda759041c1181143532d3c3dbb60d5b6ffff02165759bc42e6d65f22','2026-04-07 16:27:42','2026-03-24 16:27:53','2026-03-24 16:27:41'),(409,2,'b8acd5253b3a7c5e373b4bdb40594da711fd83b0651c05d8f9e4dcaf310682c6','2026-04-07 16:27:54',NULL,'2026-03-24 16:27:54'),(410,28,'c660d453e36fbe3029a89a37bd2e0393a20672dbfad3995b54bef0d0c23d8230','2026-04-07 16:28:11','2026-03-24 16:28:36','2026-03-24 16:28:10'),(411,28,'81d5bd5523b5c19548a9332c00e38c21be01278fc8c2ec4221e7c1f231fb489f','2026-04-07 16:28:37','2026-03-24 16:28:39','2026-03-24 16:28:36'),(412,28,'0409ee62991ca2d9d3270b7cd0fd7d5e9661c10d0be577e74b886fabe6fbd2c0','2026-04-07 16:28:39',NULL,'2026-03-24 16:28:39'),(413,29,'d22698b77fcf363de8acfb57464fe7a8dbf23c96a4ccc18c82262fac788ec3f1','2026-04-07 16:51:51','2026-03-24 16:51:54','2026-03-24 16:51:50'),(414,29,'5442b924dbd0e6bbcc56a2c67b7b050702e4b1daca011a757b450c396c91ea89','2026-04-07 16:51:55','2026-03-24 17:11:12','2026-03-24 16:51:54'),(415,29,'f2c32cfcdbb6e7171b4008d91180ddda019d129d038af04e9d10daec4f8d2eb6','2026-04-07 16:51:57',NULL,'2026-03-24 16:51:56'),(416,1,'fb7af7c7048ae5583225ab1839926a75231e60b723857b7e8a0392b250d5b901','2026-04-07 16:52:15','2026-03-24 17:11:06','2026-03-24 16:52:15'),(417,1,'b5a3309edcb9d3df719675b02f05da545476151ac83352c66d428ce23a62716a','2026-04-07 17:11:07',NULL,'2026-03-24 17:11:06'),(418,1,'14ff4d321517a6201677778787fce77fadc3dc15d10025c0d4d6e8f96091f07e','2026-04-07 17:11:07','2026-03-24 17:11:18','2026-03-24 17:11:06'),(419,29,'e22d49596a194f5e1bb85a7a1ef183a3809ce2a2e92476714a3d64286c72a026','2026-04-07 17:11:12','2026-03-24 17:11:13','2026-03-24 17:11:12'),(420,29,'9104ddf06b19aa86c6d14f454014763f1b97503477026460ee86b43a4e9eabf0','2026-04-07 17:11:13','2026-03-24 17:11:17','2026-03-24 17:11:13'),(421,29,'7a384b44f18cc88bb882ce186169c379e05f916a79209cdbaa524d3d0a64c83c','2026-04-07 17:11:17','2026-03-24 17:28:55','2026-03-24 17:11:17'),(422,1,'e28d379cb46a58751d7bfec203fec561befde5b47278f966b52ea32f48d66f20','2026-04-07 17:11:19','2026-03-24 17:11:27','2026-03-24 17:11:18'),(423,1,'3076e0e2215cc42a9e90e61b82ee4264e38866dd38ac76aa4f8b69ead128d0fa','2026-04-07 17:11:28','2026-03-24 17:38:10','2026-03-24 17:11:27'),(424,29,'3d4131fd02453f8cce4741feae73650b78b645d69b4fb22e56ab49e170cf280d','2026-04-07 17:28:56',NULL,'2026-03-24 17:28:55'),(425,1,'968e9ccdf8813aec12706c0793a10e5d6e5ef9549af1b5ad8729bbd0bd523f7d','2026-04-07 17:38:11','2026-03-24 17:56:44','2026-03-24 17:38:10'),(426,1,'76f83ff5df8c4261c11139eb1a717127c406462b2f33f228b31b831a01b7237a','2026-04-07 17:56:45','2026-03-24 18:07:24','2026-03-24 17:56:44'),(427,1,'3a92c28d620edc9fcd4b12ce4d5645c131f03b1515d25167d7b67909ef91143e','2026-04-07 18:07:25','2026-03-24 18:07:35','2026-03-24 18:07:25'),(428,1,'e402ec7505dc64a7b1706d21855d66a51124cb7ca59d6989ecb6edcaaff1e122','2026-04-07 18:07:35',NULL,'2026-03-24 18:07:35'),(429,1,'9f52d24053c922da70a07f9d077fc555755aad34510f4c11012231bba36446f2','2026-04-07 18:08:22','2026-03-24 18:08:38','2026-03-24 18:08:22'),(430,1,'8499366a4130f1074a2b6698341275df6c4d91cab6a0ec1325f72e5062d1e779','2026-04-07 18:08:38','2026-03-24 18:11:45','2026-03-24 18:08:38'),(431,1,'cefeeb57b68817a4e834572b96b0a7c3abe6fd6202e925fb92b907b559b674dd','2026-04-07 18:11:46','2026-03-24 18:12:02','2026-03-24 18:11:45'),(432,1,'3d9ebce2d034e9170bdb6da8ed2b6434f000d92decfcf75ba46961a927e2819d','2026-04-07 18:12:03','2026-03-24 18:12:21','2026-03-24 18:12:02'),(433,1,'0f7df749a148132e61a0c127c8a5823b1cf401c876ac403884d03b6e070c1b62','2026-04-07 18:12:21',NULL,'2026-03-24 18:12:21'),(434,1,'4810b5c60edc8b1fb94059e2148e108f0366db8cd6ab0d7ec0c63fd5a46fb5b7','2026-04-07 19:16:45','2026-03-24 19:16:59','2026-03-24 19:16:45'),(435,1,'ee17ba78e6f198f636775e7308a5cbf45e2423109b44a11d48b5e2565cf262d4','2026-04-07 19:16:59',NULL,'2026-03-24 19:16:59'),(436,29,'ade10cea5b6d00ab8d60b59e1bb3adde618e6f07dc64512d3fc23c93b2ade7b0','2026-04-07 19:17:23','2026-03-24 19:18:19','2026-03-24 19:17:23'),(437,29,'cc889311f196a1882fbc744a80a1bccfa4dcc41c5b7e8825708ea24afd50664b','2026-04-07 19:18:19','2026-03-24 19:18:47','2026-03-24 19:18:19'),(438,29,'685bb8593d3502d5c33772aab0c0a976c9569b92daca80772141bff22ab8032e','2026-04-07 19:18:47',NULL,'2026-03-24 19:18:47'),(439,1,'b3943929d9897ecb180a26d5731665b1bff7ba5c0fd047e7106ff34d3433f149','2026-04-07 19:19:22',NULL,'2026-03-24 19:19:21'),(440,1,'e18a51b1b9fc01c963a6eea6cdba9b3945473ede6babce68dd59afb17bb9ee42','2026-04-07 20:41:27','2026-03-24 20:42:01','2026-03-24 20:41:26'),(441,1,'f9c5c2ad7ba50714f06da4ae8ae6b3a33db6a3c64e23bf29f354b33783c5edd7','2026-04-07 20:42:01',NULL,'2026-03-24 20:42:01'),(442,29,'99d82b9f2186d7240f0762e19fdbf1051ddd87140f30d916cd8e3d870e6f1a39','2026-04-07 20:42:17','2026-03-24 20:42:41','2026-03-24 20:42:17'),(443,29,'a418b210e48f952a35b3e3af8f221111045ea3b9c2cbdff7186b770e39c3d4c5','2026-04-07 20:42:42','2026-03-24 20:42:46','2026-03-24 20:42:41'),(444,29,'4e90594336d4d3db2ddb4d6954f51f594c3bb5e1e9a3d36bde3caac581f6a9a2','2026-04-07 20:42:47','2026-03-24 20:42:54','2026-03-24 20:42:46'),(445,1,'314c47e69d809674f697a9fc835ed1752ae13418814170c0ebcf402400ec3911','2026-04-07 20:43:10','2026-03-24 20:43:43','2026-03-24 20:43:09'),(446,1,'519eac7a05a509146f3b57f42f70da4802f834199e37b39d186ccc4aab885d3e','2026-04-07 20:43:43','2026-03-24 20:50:50','2026-03-24 20:43:43'),(447,1,'a22c6e5be6b87d19ddbdbd773307e39d1311639ba092caa788462490e40a9ef0','2026-04-07 20:50:51','2026-03-24 20:51:03','2026-03-24 20:50:50'),(448,1,'387b3a0de0c0e45655037923cc55cb3004fdb93beb4841e6595612386a507642','2026-04-07 20:51:04','2026-03-24 20:52:02','2026-03-24 20:51:03'),(449,1,'0ded5b2e67a98fad5e916190fc32e6acad2ea33c7b3792819532e9f22126feea','2026-04-07 20:52:03','2026-03-24 20:52:21','2026-03-24 20:52:02'),(450,1,'ad979d056f3686ad45186febe1205d297ec8efb69d939a776ff21162643d0603','2026-04-07 20:52:21','2026-03-24 20:53:16','2026-03-24 20:52:21'),(451,1,'3920b861ec1d86df578490fdf64cc8447e17a76a82af5453a75af43530b19860','2026-04-07 20:53:17','2026-03-24 21:01:02','2026-03-24 20:53:16'),(452,1,'f23359896eeacf0153e833501e6f79161f0f9debace91bd354c7051733c93744','2026-04-07 21:01:03','2026-03-24 21:08:42','2026-03-24 21:01:02'),(453,1,'65048d1fb00b75bf8cb6dee33470f587a29881825e4fa3908924578d8235dd81','2026-04-07 21:08:43','2026-03-24 21:09:04','2026-03-24 21:08:42'),(454,1,'b668c6482405ad192716915a2d176df598bd6f24ce6254ab0d164ce39daa3ab9','2026-04-07 21:09:05','2026-03-24 21:11:18','2026-03-24 21:09:04'),(455,1,'b897db7d7cad7a05ec7bff3ac9463d819994f78d36ad669795f04c119a716da5','2026-04-07 21:11:19','2026-03-24 21:11:24','2026-03-24 21:11:19'),(456,29,'5c7248f7d882607e378b9e85f9dc8b77be9ca946763d53c7f8ac34e722d8afcd','2026-04-07 21:11:39','2026-03-24 21:11:55','2026-03-24 21:11:39'),(457,29,'9fd33b43ae268bd6eaf778eeb0baa05e125a1a7066554a97a82eb0e2092d45c7','2026-04-07 21:11:56','2026-03-24 21:11:58','2026-03-24 21:11:55'),(458,1,'c29a856832f84773df96855055384c85e92bd052558da6884079d553fe3f56d6','2026-04-07 21:12:11','2026-03-24 21:12:28','2026-03-24 21:12:11'),(459,1,'ec424eee67538c572eb3322e191086a94be7b3ff4a13f33c45a99e9ab0716c72','2026-04-07 21:12:29','2026-03-24 21:12:44','2026-03-24 21:12:28'),(460,1,'3f11615e4c26948ca24a88ff11fc647608f328696560b68c3017a984914e3d3f','2026-04-07 21:12:44','2026-03-24 21:55:26','2026-03-24 21:12:44'),(461,1,'fabc9386f7e66f80e07ee029849724e3bf853365f01b03a63149109f702126db','2026-04-07 21:55:27','2026-03-24 21:55:27','2026-03-24 21:55:26'),(462,1,'db6be353a2ef05b981c251f1056f45544a449d2b7a254df3709a016067afc5bd','2026-04-07 21:55:27','2026-03-24 21:55:27','2026-03-24 21:55:27'),(463,1,'efa5e3aacc5e44c22c753a00ae1a8369075c6de633b49a0c2ab8fb1134d72920','2026-04-07 21:55:28','2026-03-24 22:20:30','2026-03-24 21:55:27'),(464,1,'62071f2843ce4435cafca972d257e487a4262d72dc1de27f1f87642c3fef6e52','2026-04-07 22:20:31','2026-03-24 22:20:33','2026-03-24 22:20:30'),(465,1,'10c9c95c1530c8aeb8961f29e5a185888a0648873e51f735bdaee3a10835fa8d','2026-04-07 22:20:33','2026-03-24 22:32:04','2026-03-24 22:20:33'),(466,1,'ae31e61489f35a5cca7f6e3ffae2d5e55d739c2f0b110da32564754644eb1d35','2026-04-07 22:32:05','2026-03-24 22:36:48','2026-03-24 22:32:04'),(467,1,'25c1db57da49e87f3d092e40bb86a56fcec393d47365915258577aae1121ca6b','2026-04-07 22:36:49','2026-03-24 22:40:50','2026-03-24 22:36:48'),(468,1,'e4e204f58c2cd9ea5cc9e174747c5a19e55b4e7da5d6677f7f6ee5877181e03f','2026-04-07 22:40:51','2026-03-24 22:52:34','2026-03-24 22:40:50'),(469,1,'2369658736d364bcbeadb1c3cca515fabb9aa64f862711e6c7361117cdbbc22c','2026-04-07 22:52:34','2026-03-24 22:53:30','2026-03-24 22:52:34'),(470,1,'540a7e1a00b71eaf6f4952511015857cb8dd80ab3ef75c9a0a6322f9c9a40637','2026-04-07 22:53:30','2026-03-24 23:43:11','2026-03-24 22:53:30'),(471,1,'3affb9a4ea45d975e2250fadc5f5e4e69b277e6a1afde5822b237a20993fd9a8','2026-04-07 23:43:12','2026-03-24 23:50:58','2026-03-24 23:43:11'),(472,1,'fadb950cc63432e94e558d7e0db2001ca0b6f8bba13b01ae60978fd393435308','2026-04-07 23:50:59','2026-03-25 00:03:20','2026-03-24 23:50:59'),(473,1,'c5845f7c454a5ce415255c85d8a7d87ecbf3ae165386f55830a82e390073c6dd','2026-04-08 00:03:21','2026-03-25 15:56:52','2026-03-25 00:03:20'),(474,1,'56265513500eedf5e51640904ca07b9c7c29b6d424588a63d036f16f75ae10a8','2026-04-08 15:56:52',NULL,'2026-03-25 15:56:52'),(475,1,'132323aae59a143cd4fa25f2a1b20c3b482ad26182a261de5d056cbf08695dba','2026-04-08 15:57:09','2026-03-25 16:30:27','2026-03-25 15:57:09'),(476,1,'65088351632e96071097e867ad2107c2f33f7ca9203bb0df68df494cf1bae390','2026-04-08 16:30:28','2026-03-25 16:31:52','2026-03-25 16:30:27'),(477,1,'cdb200e4681fd395e3b7deb3461a1d7cb327b16a8eb2136cfebdeb31b611b4d6','2026-04-08 16:31:53','2026-03-25 17:27:32','2026-03-25 16:31:52'),(478,1,'1505309e00adb429e1d30e72c901c37c64fbe86caa72fc8f5696b318908d5241','2026-04-08 17:27:32','2026-03-25 17:29:58','2026-03-25 17:27:32'),(479,1,'dbb345727baecb2a37f2b6e8690aa1fab7295b25638a19dc6cc34bfa9d394421','2026-04-08 17:27:32',NULL,'2026-03-25 17:27:32'),(480,1,'46a6e172cc8b0b20cb48bc7011bf663485131ac073831bb7d38ce82d594e1f2b','2026-04-08 17:29:58','2026-03-25 17:30:40','2026-03-25 17:29:58'),(481,1,'df2fd65e3664ca1fd2ffb695456b599b70c01d34e0cdeec4621e80b24c984ee6','2026-04-08 17:30:40','2026-03-25 18:11:42','2026-03-25 17:30:40'),(482,1,'798db862abaa0a85f20133ccdfa76ccb6d29692ea05ea4bdc80398bbd94b0ea5','2026-04-08 18:11:43',NULL,'2026-03-25 18:11:42'),(483,1,'79dc1593e8579a848c9073f413119af151a95837fc5434e5cde7e989ab5f8110','2026-04-08 18:12:08','2026-03-25 18:12:52','2026-03-25 18:12:07'),(484,1,'6a0a59484757098719c2436fa59f11f3787aa4396688a3b4dd0908f89c4fe391','2026-04-08 18:12:52','2026-03-25 18:35:44','2026-03-25 18:12:52'),(485,1,'c767624610c65110413c2f1cde457065fa4a55be09a958aa2703099319249a89','2026-04-08 18:35:45',NULL,'2026-03-25 18:35:44'),(486,1,'44546cf2743c8580a424c8ea2cc3a5dea2e2ca4e5759bc4f97a846e857566de1','2026-04-08 18:36:03','2026-03-25 18:36:46','2026-03-25 18:36:02'),(487,1,'05d53cd50a76384b5e7b25635e05d079a892b20083da05da3d170a77df95edb2','2026-04-08 18:36:47','2026-03-25 18:43:12','2026-03-25 18:36:46'),(488,1,'289af180b07070282c86ede76875fd5b33701773367e474f6f451bdcba8a952f','2026-04-08 18:43:13','2026-03-25 19:34:16','2026-03-25 18:43:12'),(489,1,'190b20fa315a81fc27711ba302ec606f25e3ba835c337500c61c14753d9e66d7','2026-04-08 19:34:16',NULL,'2026-03-25 19:34:16'),(490,1,'ec2ae70c4f4ab87575c24a67a4ff23b2212cd4d6819d31d8e9c1c11a34b41527','2026-04-08 19:34:16','2026-03-25 19:34:24','2026-03-25 19:34:16'),(491,1,'ced4121f9cc0320073180da8851e04d90fdc6f14d0a4dfd81bd3208d22e42a5d','2026-04-08 19:34:24','2026-03-25 19:47:46','2026-03-25 19:34:24'),(492,1,'68cb3f0f392bd084befb79d3a9e28d6e3b78de42b0357273931636f30d8a3df3','2026-04-08 19:47:47','2026-03-25 19:49:27','2026-03-25 19:47:46'),(493,1,'aacb25a65203aece56d310ee841ba8b5ef07999de406bf89c6c5b1f4a03fc8b0','2026-04-08 19:49:28','2026-03-25 21:44:17','2026-03-25 19:49:27'),(494,1,'20dd20b876080186dd83b95cb9217e571e11e512e1b2a6544acd32e897616234','2026-04-08 21:44:17','2026-03-25 21:44:17','2026-03-25 21:44:17'),(495,1,'1a40d30b331a15f15acd0720216efbbab17fe29cc7a74cccb49102c9b6ac8549','2026-04-08 21:44:18','2026-03-25 21:45:26','2026-03-25 21:44:17'),(496,1,'819f8ef34bd65a68628ac6a9c5ec789f67c019652327c709a095cb0805df0fca','2026-04-08 21:45:26',NULL,'2026-03-25 21:45:26'),(497,1,'216c972b1347f05fad94150e67fae89b7fa9ec0fdbe0bee41b9ca4899546b2ef','2026-04-09 06:19:58','2026-03-26 06:34:47','2026-03-26 06:19:58'),(498,1,'4b8db78a3e438c217ec6b030bdcf64c7be95e8f5d44fe5bd8ce8a968ed69d6d5','2026-04-09 06:34:47','2026-03-26 06:34:55','2026-03-26 06:34:47'),(499,1,'8fedc0f3ca51dc18c2c919dc49f1760dad059da51ce98420ba6f203868784554','2026-04-09 06:34:56','2026-03-26 06:34:59','2026-03-26 06:34:55'),(500,1,'5cbfd760d05a37b88a9f14121ba0319457d15ba2294e27325e4ac950d6ef1052','2026-04-09 06:35:00','2026-03-26 06:35:18','2026-03-26 06:34:59'),(501,1,'69043ba2ed9eb583692276e37f5d1147dcc422a37d0377ad7550bc9b59ad0bcc','2026-04-09 06:35:18','2026-03-26 06:36:25','2026-03-26 06:35:18'),(502,1,'5438728ed3aef25dbf838994ede9398d5a32c8c37f14ae6d68b1cb9e110792a3','2026-04-09 06:48:06','2026-03-26 06:54:15','2026-03-26 06:48:06'),(503,1,'a4dac9e4b07f2b62d51fd4676afd75da49ae5180f1f08ca4eb64ba04af8f52b1','2026-04-09 06:54:15','2026-03-26 06:54:16','2026-03-26 06:54:15'),(504,1,'e72a54e6323a1c80131fa72ee0cad25db63ad73f9aa963b7fa22372771a0e1f2','2026-04-09 06:54:16','2026-03-26 06:55:17','2026-03-26 06:54:16'),(505,1,'852d002137e6556f167a57728ee7f5fc889a4dba1a83ca5b20e33e35440b9359','2026-04-09 06:55:18','2026-03-26 06:55:29','2026-03-26 06:55:17'),(506,1,'2c429a871698a786b116bd2e1c38fb1d9e2164a77d8a790e0113b153a58e56bb','2026-04-09 06:55:29','2026-03-26 07:01:39','2026-03-26 06:55:29'),(507,41,'6331b6230d48ba36536d5675f589a2b9e8304dc9068c8476670a6dc740331c0d','2026-04-09 17:38:16','2026-03-26 17:39:36','2026-03-26 17:38:16'),(508,41,'8de384f29c0af9ee6300697ae8981b0fed117c3a93bc0a0516edf3df29d8ede1','2026-04-09 17:39:37','2026-03-26 17:46:44','2026-03-26 17:39:36'),(509,41,'127eb0f999bb9b6ab643c7002ea9a799d1bff097ed0e80d76f25388eca44f733','2026-04-09 17:46:44','2026-03-26 17:46:47','2026-03-26 17:46:44'),(510,41,'df5f8280d72ac592ca57be23e91575634ce7d20d2b38ed0fc6aacfb8f32bd366','2026-04-09 17:46:47','2026-03-26 20:38:53','2026-03-26 17:46:47'),(511,41,'77921f465e774fae4abe9d248006a1b6076bb4420994ee86afd9ca13fb8810f6','2026-04-09 20:38:53',NULL,'2026-03-26 20:38:53'),(512,41,'3466b272c8ec1744c337a70d7671322eade811c950fa6f54ce34380e77a1c744','2026-04-09 20:38:53','2026-03-26 20:39:21','2026-03-26 20:38:53'),(513,42,'dc0db0ec10baa0fec457a1de7cd6827e9923e36ce7c116562048fba6270b2b1a','2026-04-09 20:40:19','2026-03-26 20:41:30','2026-03-26 20:40:18'),(514,42,'255cfec16693b579df6f4173d7cae37e9da9e49af42bfca4343849d956f2e7ad','2026-04-09 20:41:31','2026-03-26 20:49:29','2026-03-26 20:41:30'),(515,42,'2d76c8aedc719011c9a97e50fcbd222873bdd7e23d06ebe9344b4dcbc774d86f','2026-04-09 20:49:30','2026-03-26 20:50:22','2026-03-26 20:49:29'),(516,42,'79237ab7e2b3ef2ed30df7e6fed00b72d555dff9c451ddff262d902e3e9dc8d6','2026-04-09 20:50:22','2026-03-26 21:33:31','2026-03-26 20:50:22'),(517,42,'6fe5bc1dc0da07d591b8fa839f32a1d93ca8fb9a7443eb6417acdc42d00e4758','2026-04-09 21:33:32','2026-03-26 23:21:59','2026-03-26 21:33:31'),(518,42,'f1a3601684a36f82d7adee6fb96c83f0582d18d1e4adcf1ae953909c97fa6a0c','2026-04-09 21:33:32',NULL,'2026-03-26 21:33:31'),(519,42,'4871831aafd2e104d92c9c678357e6b83475cc7a032f40fed6d1f0f330e29143','2026-04-09 23:22:00','2026-03-26 23:21:59','2026-03-26 23:21:59'),(520,42,'0ae61d3d072f651f49419a0ae4a9f3ae5b8b6f00187d6efb59f01d4c9f4ae1e7','2026-04-09 23:22:00','2026-03-26 23:28:43','2026-03-26 23:21:59'),(521,42,'0e4eea9a50c878c8fea3dbbe7e8e9123f7ce5a418897913c5c1ef2ae1c8c391f','2026-04-09 23:28:43','2026-03-26 23:39:50','2026-03-26 23:28:43'),(522,29,'432ec8ef73b7c2f6b7715df35ca4afc60947c28d4ba5411439b83fdb5bc44ead','2026-04-10 08:15:59','2026-03-27 08:17:35','2026-03-27 08:15:58'),(523,29,'6b267e85b095499d6ac29be5c15afabbf62ecf36d1e0aaafab54cc04530d71ab','2026-04-10 08:17:35','2026-03-27 08:46:29','2026-03-27 08:17:35'),(524,29,'d03f25bedf708ad0ba7c733ca1ca82c90729f3ebce3635e9b6dc927692d260b1','2026-04-10 08:46:29','2026-03-27 08:46:53','2026-03-27 08:46:29'),(525,29,'911aed02671f6bb8fd436366e09b604d374b23e8ad1e56686265eaa45c4fe5c6','2026-04-10 08:46:54','2026-03-27 09:58:47','2026-03-27 08:46:53'),(526,29,'04a28e79650755e7171e61a6f42af0690cc349c382cc2dc32a6bcb2d3d87db24','2026-04-10 09:58:48','2026-03-27 09:58:48','2026-03-27 09:58:47'),(527,29,'7c057ac6c07b2336fec7d16813ba82f4e7c5b10be3262716f45b26e2c48f50af','2026-04-10 09:58:48','2026-03-27 09:58:48','2026-03-27 09:58:48'),(528,29,'08a1226665f8c942b15a2ffb0b2fecce2d2aca587505c96c60e864e561284d6a','2026-04-10 09:58:48','2026-03-27 10:57:20','2026-03-27 09:58:48'),(529,29,'e69f0cfe90790e2f46b6407ec53280a1ca35c12b5b65deac60c2e959716c9b7d','2026-04-10 10:57:20','2026-03-27 10:57:20','2026-03-27 10:57:20'),(530,29,'566d3ab5efa94abc6af47d813317dc6f8521f312d5d084e1b70511c32e54c71e','2026-04-10 10:57:21','2026-03-27 10:57:20','2026-03-27 10:57:20'),(531,29,'cd9b0a18abd04f05ac165302c4e7cdb61210484f021a2ff9bcbf7271e9df5d8f','2026-04-10 10:57:21','2026-03-27 11:11:15','2026-03-27 10:57:20'),(532,29,'8d8830ddb06f601efc71b1ce608f9982a8078bbadd650ec800d03a2d0eaf9aef','2026-04-10 11:11:15','2026-03-27 12:31:30','2026-03-27 11:11:15'),(533,29,'c6d517a7f02e4b07ba81d265295c46a56cac89845dc4e5d61ec73d08ca9da9b1','2026-04-10 12:31:30','2026-03-27 12:31:30','2026-03-27 12:31:30'),(534,29,'0f6e3492e4026d79d6caceeada735de51e087b54e82ef9419ef93d5869f452ec','2026-04-10 12:31:31','2026-03-27 12:31:30','2026-03-27 12:31:30'),(535,29,'dfb2c1eafa0b788dbd86698abbe835d75590b7c4d684f8056a35d7aebb91ee38','2026-04-10 12:31:31','2026-03-27 12:58:49','2026-03-27 12:31:30'),(536,29,'a18cf4a15df45f8dce58edbb9cd106b378c5eba12b8912d2b5945940f9700b5b','2026-04-10 12:58:50','2026-03-27 13:00:54','2026-03-27 12:58:49'),(537,29,'4ece11aef777c9414e4f170a761012c451d8d942a2a19005977dcb03afc1288a','2026-04-10 13:00:54','2026-03-27 13:00:54','2026-03-27 13:00:54'),(538,29,'9de619fe17e36ed4b00fb0eaa0e3714b6ef0ae23659953f26a3bcb289bfb071e','2026-04-10 13:00:54','2026-03-27 13:00:54','2026-03-27 13:00:54'),(539,29,'c61b34f080898e941bc0946014136cf2dba53b400b5b96add6688d4ff40e71e2','2026-04-10 13:00:54','2026-03-27 13:16:00','2026-03-27 13:00:54'),(540,29,'86299766b06d3bf184082c61008b8be65da2192897229f22f50e48770ae3a277','2026-04-10 13:16:00','2026-03-27 13:16:39','2026-03-27 13:16:00'),(541,29,'2a27257c9eb060fe99219c9721483a321d1832ff81a777b485e45c143f502b0d','2026-04-10 13:16:40','2026-03-27 13:16:53','2026-03-27 13:16:39'),(542,29,'9ae996e35eb412977bddf820faea4d8d9481d86b22c5e99b55ace0f0d3251f38','2026-04-10 13:16:54','2026-03-27 13:17:21','2026-03-27 13:16:53'),(543,29,'26a2959ad751cb4b69298f743e8f9386f7d5f142bcc53802c6debad8510713c1','2026-04-10 13:17:21','2026-03-27 13:18:17','2026-03-27 13:17:21'),(544,29,'3193cbb9a0ca536655e49b1b7d35f21de25a222fd3c5fd821cad430ccc819d28','2026-04-10 13:18:18',NULL,'2026-03-27 13:18:17'),(545,29,'71f85a1b7fead6701659103306ad92c2f556b7aec25471a65b67134b38e3590a','2026-04-10 13:18:36','2026-03-27 13:36:47','2026-03-27 13:18:36'),(546,29,'284140d9a112e647a66f3b952698e0599040dc823f5a5f67e6d3b3769ac0c8e8','2026-04-10 13:36:48','2026-03-27 13:37:06','2026-03-27 13:36:47'),(547,29,'bc26db6babd602f0c1f0ff6259ac74ac1527fcb20d63399b43a4023b64ad49e3','2026-04-10 13:37:06','2026-03-27 14:02:34','2026-03-27 13:37:06'),(548,29,'de9c6561ebc8123ce22ea0c9ba852e29bed57d67abdcc5f90e96934351d0307d','2026-04-10 14:02:35',NULL,'2026-03-27 14:02:34'),(549,1,'6f3d4dda4aee4ce4e44e8194a92d5b7c5b1630d7f3d4d2d5b34459698d519ea8','2026-04-10 14:25:48','2026-03-27 14:34:47','2026-03-27 14:25:47'),(550,1,'25c2643428b968953a44e00babf0c26978ffd76e25b6baf0da0d6501b3711fcb','2026-04-10 14:34:48','2026-03-27 14:48:01','2026-03-27 14:34:47'),(551,1,'2ee48722c580197f160f1a3ba869dc6a8030433b5e940015227c54d603bd048e','2026-04-10 14:48:01','2026-03-27 15:11:19','2026-03-27 14:48:01'),(552,1,'5e1a2a36ec5128679bffbaf4f957936d20ef6a8a0bb7833b88c443e763d97350','2026-04-10 15:11:19','2026-03-27 15:11:19','2026-03-27 15:11:19'),(553,1,'0b48a6d0b2d5d529509cc92f1320350b43fe51f4669a6fbfc442a61234281a36','2026-04-10 15:11:20','2026-03-27 15:11:24','2026-03-27 15:11:19'),(554,1,'0f615b7e934ea6c005caf9ad171588552114b87305a278744356d9cea21910cd','2026-04-10 15:11:24','2026-03-27 15:17:10','2026-03-27 15:11:24'),(555,1,'780eb5b917152e4a6a248a376e737453bdf39a0d8fb56109eeac9fab5d0ffa8d','2026-04-10 15:17:10',NULL,'2026-03-27 15:17:10'),(556,28,'2d85340c34b12a7dadf7a32449446c294d352d0c0b54f1a30d4ff8269e04e31b','2026-04-10 15:17:23','2026-03-27 15:18:39','2026-03-27 15:17:22'),(557,28,'8eaf6c70cd80210b9d3ba975a327fec56751dbfe48ae01363f8a30aa5e26daf7','2026-04-10 15:18:40','2026-03-27 15:47:23','2026-03-27 15:18:39'),(558,28,'8536335805b1fd87515ab77d3908329d4125746ef739998a19a5a353b43324fd','2026-04-10 15:47:24','2026-03-27 15:47:23','2026-03-27 15:47:23'),(559,28,'4bed3ccf34f1f3710c2f947e518ed779420af0d63a296e7033fc9c8f5291305a','2026-04-10 15:47:24','2026-03-27 15:47:23','2026-03-27 15:47:23'),(560,28,'8ed238573c6606c17b19646c5129a585018d53ffaaf20d8279831381c5bc8e39','2026-04-10 15:47:24','2026-03-27 15:47:23','2026-03-27 15:47:23'),(561,28,'567a61441522eb1e75b3dd50e819485ce6d6281e5078c01bd6eae055fc2a2480','2026-04-10 15:47:24','2026-03-27 15:47:24','2026-03-27 15:47:23'),(562,28,'6edc4ed0cd27014b22c417ad7cedd456b23e8f002d9c7b672d2da5b9443592f4','2026-04-10 15:47:24','2026-03-27 15:47:24','2026-03-27 15:47:24'),(563,28,'f7feb5f4c9d413d762c12a94a49cf912f83a0cd44756fd83b9455194debe9d1b','2026-04-10 15:47:25','2026-03-27 15:47:24','2026-03-27 15:47:24'),(564,28,'49e6ca0b9e63161e10e3429baa9fc49618f7de0c292bd1fde028cf729b9eb2fe','2026-04-10 15:47:25','2026-03-27 15:47:25','2026-03-27 15:47:24'),(565,28,'9921f422a614b18107a8792d364f060ac5f3804f657aaf3fd72d25bcebb56cbe','2026-04-10 15:47:26','2026-03-27 16:02:56','2026-03-27 15:47:25'),(566,28,'973051fd51f27f3aa2e4ed0b5d6fa8cf111ab52e3fb9a5ee36a304a99cb0aaed','2026-04-10 16:02:57','2026-03-27 16:03:06','2026-03-27 16:02:56'),(567,28,'66d0d195af1b6391620f23ab3beedbec5b18ddb4ab6bbe8180b044d4de7d7e04','2026-04-10 16:03:06','2026-03-27 16:03:07','2026-03-27 16:03:06'),(568,28,'87cb82b58fc66192d25ea44185389daeb774ce2fa0259ad52c0a7ebf5afd6ef7','2026-04-10 16:03:08','2026-03-27 16:03:10','2026-03-27 16:03:07'),(569,28,'0410a0491fbc1002d6c7f5abf37f586a896ef733d7106604c50b77014057a0df','2026-04-10 16:03:10','2026-03-27 16:03:10','2026-03-27 16:03:10'),(570,28,'31a7c28f7f83179c3fe21a01d5a0f42ec40fead41578292fca9fa24bfee4366d','2026-04-10 16:03:10','2026-03-27 16:59:49','2026-03-27 16:03:10'),(571,28,'50014f9b97ccce2a324932a116551614983d87c75f9e7feab9355c58716e34fd','2026-04-10 16:59:49','2026-03-27 17:00:17','2026-03-27 16:59:49'),(572,29,'358e1b759fe3b9f840218feae6ee165619b37dea506ee5243f152ccbb0557b74','2026-04-10 17:00:44','2026-03-27 17:28:34','2026-03-27 17:00:43'),(573,29,'9273a923306915aaf5215da9218ea8e3bfb6fc3fbf7c8946583d35ff047caab8','2026-04-10 17:28:35','2026-03-27 17:32:54','2026-03-27 17:28:34'),(574,29,'82846560aa401a76d62b7572b2d385f25536f0f1ef189b9bf5f1e957d2034468','2026-04-10 17:32:55','2026-03-27 17:52:48','2026-03-27 17:32:54'),(575,29,'27142d567183f830fff1752576ee81c1ecdcdd47c7f07e100b6907d677ddd8f0','2026-04-10 17:52:48','2026-03-27 17:53:01','2026-03-27 17:52:48'),(576,29,'78c54f911d3f2fdcb63b32b9856481d69bbd5c780933d0f587ac3938be8df63e','2026-04-10 17:53:02','2026-03-27 17:57:01','2026-03-27 17:53:01'),(577,29,'58fa165a8b1012b075ea0ff83bc519b9a503ed59e3b7ce3df1563ec55687fed6','2026-04-10 17:57:02','2026-03-27 18:07:15','2026-03-27 17:57:01'),(578,29,'d1a6977e8f502886874c9a3bf11668d9d8d4c9d93e57ef8b621702c1e9316181','2026-04-10 18:07:16','2026-03-27 18:17:17','2026-03-27 18:07:15'),(579,29,'a09c93f664f3237edd5dad8da32f99e514dc5a0c10a747cf4cb1dba10347e540','2026-04-10 18:17:18','2026-03-27 18:18:20','2026-03-27 18:17:17'),(580,29,'c657f6c7e8d71978a75c97258866bddf9d91ee9b468130ccc54dee04a091ea8c','2026-04-10 18:18:21','2026-03-27 18:35:06','2026-03-27 18:18:20'),(581,29,'af84a109612e8dcccf06074234b4f4c9f84af57b411512e8aebd4ec201a8c2ac','2026-04-10 18:35:07','2026-03-27 18:35:10','2026-03-27 18:35:06'),(582,29,'3d16a562d2a6f00af07f6a3d5db513f6d2d8e6feea2e8e90b91bedbeb59f9b7b','2026-04-10 18:35:11','2026-03-27 18:35:10','2026-03-27 18:35:10'),(583,29,'3e2529aece130b14b9c6f9d8863d5908696d749aa0e16fdf58b30f885c3c4fa3','2026-04-10 18:35:11','2026-03-27 18:36:54','2026-03-27 18:35:10'),(584,29,'e3eff6b481d8de4071200fa8cb36eaad3ced6c5261c40d2245391e7dce6e41a2','2026-04-10 18:36:55',NULL,'2026-03-27 18:36:54'),(585,43,'879c5cff8e38ef98c9a1f8a3b8eee76724bfc31cd4a1d2953dde614d723ef5f5','2026-04-10 18:48:47',NULL,'2026-03-27 18:48:46'),(586,44,'acf2fcdbc5569e50715993bc910a27284e50de996c08e59e54f0e3ddfb7037db','2026-04-10 18:56:46','2026-03-27 18:58:20','2026-03-27 18:56:46'),(587,44,'7c2d24f001c552f7453c83e52f67f8d9ea624cd5f157aa4a4dc6f4ad8af114e7','2026-04-10 18:58:21','2026-03-27 19:07:54','2026-03-27 18:58:20'),(588,44,'0146f348c3cdc7c018bba3f833057c31a38cd097b125ecf18ff2e8724f342197','2026-04-10 19:07:55','2026-03-27 19:09:54','2026-03-27 19:07:54'),(589,44,'67008ef0b2e177a993e111ea1c421d14b55e09004fe2b92ce2a28d8f3ce7c6cf','2026-04-10 19:09:55','2026-03-27 19:10:19','2026-03-27 19:09:54'),(590,28,'f5e46d690ec2a44cd61ba09afc5af6e2a3a313f93f1f3fe1e2bb6255be434219','2026-04-10 19:10:46','2026-03-27 19:20:06','2026-03-27 19:10:45'),(591,28,'c724397218dc138d4e38084c6e12cfc3c318a3ef4fa2de5ee0f14b5c7b1993eb','2026-04-10 19:20:06','2026-03-27 19:33:36','2026-03-27 19:20:06'),(592,29,'146cc5e531cf4c8d44dab083e1b4e2e4ab3f1e5689ca6db198f8fac7f273fb30','2026-04-10 22:25:56','2026-03-27 23:10:59','2026-03-27 22:25:55'),(593,29,'7499605aa77e9524d320d4a13cbf15ba5e51d133590fad79588ce84d675ec2db','2026-04-10 23:11:00','2026-03-27 23:11:09','2026-03-27 23:10:59'),(594,29,'e70b3daf2df6862d3df9961db26506c84dd1e54ff645c7604a21a9ca2767f28b','2026-04-10 23:11:00',NULL,'2026-03-27 23:10:59'),(595,29,'bf5acbda1a82e1bdb48e3880360570c3c11b02475d5348608e5aa3b8ac151c0c','2026-04-10 23:11:09','2026-03-27 23:11:12','2026-03-27 23:11:09'),(596,29,'370f679837b294504d54eb84c3064112c21baf202a5765ebe9df4766c2e38d61','2026-04-10 23:11:12','2026-03-27 23:12:39','2026-03-27 23:11:12'),(597,29,'77e64eb4719c652dc9843ab57149a8b0ec31253458fd5294b866e611396ad2e1','2026-04-10 23:12:39','2026-03-27 23:28:27','2026-03-27 23:12:39'),(598,29,'7d14c4da6f1e0e9b1f1ccb10266092c39252cd4dbad7c95f3473dfd1a5ed0a1f','2026-04-10 23:28:28','2026-03-27 23:32:17','2026-03-27 23:28:27'),(599,29,'f66826307140184a81cbc03461e23e6700b91e46627179ba17e985d9d0aa6a17','2026-04-10 23:32:17','2026-03-27 23:32:51','2026-03-27 23:32:17'),(600,29,'677dcccf1dc6ca912212f826de6f256ee1785a895f09bd9947b587526d2f3e03','2026-04-10 23:32:51','2026-03-27 23:36:17','2026-03-27 23:32:51'),(601,29,'27a65eb331573ea15817cba1099fd2507faab301c30d5f87c49c3de61789a12e','2026-04-10 23:36:18','2026-03-27 23:48:20','2026-03-27 23:36:17'),(602,29,'a78e48918cc94dc7a24181b9adfa0e3f4b75e47f81b408544ea489555a6df463','2026-04-10 23:48:21','2026-03-28 00:03:33','2026-03-27 23:48:20'),(603,29,'2e700f8c82175829348f977fe0e0ec7eedf895e86d816cecc11c12b12ca09385','2026-04-11 00:03:33','2026-03-28 00:11:31','2026-03-28 00:03:33'),(604,29,'c16bd0bdd9ba1283a1648516dadcf3e2c1da6aac13608bf9c5fea2f6d506e581','2026-04-11 00:11:32','2026-03-28 00:11:31','2026-03-28 00:11:31'),(605,29,'ab893b9bda370be835f83ff0aa8a970ae462f4f03e6404c0ba99098345078dbb','2026-04-11 00:11:32','2026-03-28 00:34:11','2026-03-28 00:11:31'),(606,29,'7ee06eac986e545d3d90e423d7128b392a24e121b216c4ee681389561d204bdb','2026-04-11 00:34:12','2026-03-28 00:49:52','2026-03-28 00:34:11'),(607,29,'0f84cca689c827cf687fe839c7436cd4bf6df873baafad31416aa6525d62af47','2026-04-11 00:49:52',NULL,'2026-03-28 00:49:52'),(608,29,'b69c7c410b82573524d67f0b36d55bdeeb9d6bf9c6459dc7fa69dcf17cc06ec8','2026-04-11 00:50:30','2026-03-28 01:14:18','2026-03-28 00:50:30'),(609,29,'5b4c2ce9d2e33931313482c44eca3085a29eb6dbcdbef87af32a0942e27a2109','2026-04-11 01:14:19','2026-03-28 01:44:05','2026-03-28 01:14:18'),(610,29,'2b1f7fbfb8c1be8009da0958d73ef1497408796413872eee5714519dfccaa24e','2026-04-11 01:44:06','2026-03-28 01:45:11','2026-03-28 01:44:05'),(611,29,'5266f96fa3997653de4fcf52c119ac135e420b5cf27bb1ace6093694fefb2574','2026-04-11 01:45:11','2026-03-28 09:43:03','2026-03-28 01:45:11'),(612,29,'2249c11b443ab81c298afcca56a70da9d39b31f23fbe695397453a07a6d1c8df','2026-04-11 09:43:03',NULL,'2026-03-28 09:43:03'),(613,29,'ba2b77149b64bfdd495cdc10ad4bec0ed1d6605666bd74fc6f860b77d3ac90c8','2026-04-11 09:44:54','2026-03-28 09:45:37','2026-03-28 09:44:54'),(614,29,'fcd7e11f86a932edeac3d511965297a3befcf4e97c9ec342c3c8ae8ac533959d','2026-04-11 09:45:37','2026-03-28 10:06:41','2026-03-28 09:45:37'),(615,29,'fb4d4bc657dd538661c37eaa74e9eab92b01f6763e8ebc5bd2621f1eaa37ecee','2026-04-11 10:06:42','2026-03-28 10:07:02','2026-03-28 10:06:41'),(616,29,'a36d2bb86f6b12fe48e0910cb5cb8875765e6f19384ed249a2ad4510118b3e61','2026-04-11 10:07:03','2026-03-28 10:07:49','2026-03-28 10:07:02'),(617,29,'90748b575d80685a3eb73cedbdf39ae0eb3a1c44cc2a2be106fc7f5810b9d038','2026-04-11 10:07:49','2026-03-28 10:07:51','2026-03-28 10:07:49'),(618,29,'8dcefb91a3c4960c82b012d5d3d9f3cfc7895f8aa44f9f2cb4819b07c0cd65de','2026-04-11 10:07:52','2026-03-28 10:10:21','2026-03-28 10:07:51'),(619,29,'de4e501a28dd188f6933ab13cb24cf653c73f76841339ec70c666e4d913a62e1','2026-04-11 10:10:41','2026-03-28 10:21:46','2026-03-28 10:10:40'),(620,29,'c3f57dfbe760d51734bca1097add0f352361ef00c74bf48fb29e970f88c84c11','2026-04-11 10:21:47','2026-03-28 10:22:08','2026-03-28 10:21:46'),(621,29,'c8944b8fbd6b713b5dbc5669a9118e0f37706e28d309f47cca9272c84a73d34f','2026-04-11 10:22:21','2026-03-28 10:43:02','2026-03-28 10:22:21'),(622,29,'2074e60485e9c9ef6b637108d492fcf76ffc4ee6edbb471135fceba95d651d55','2026-04-11 10:43:02','2026-03-28 10:43:32','2026-03-28 10:43:02'),(623,29,'0deabb79ad5dd5ef9b18838fa5cae798caf7963f864fe94fd4c00693ff05a258','2026-04-11 10:43:32','2026-03-28 10:43:56','2026-03-28 10:43:32'),(624,29,'e0f6082a0d9894ca69e5aeb5f54b2ea14a00773f417cac39638d5c4a85ea7636','2026-04-11 10:43:56','2026-03-28 10:59:42','2026-03-28 10:43:56'),(625,29,'2414eb08cd059924f565366cdda1359aa2af5b88e8871da184023f22d218eda7','2026-04-11 10:59:42','2026-03-28 10:59:42','2026-03-28 10:59:42'),(626,29,'6f9d482fe1a0c33c0f0bc370ac03c6090553333b19658c3b633817c34efb136c','2026-04-11 10:59:43','2026-03-28 11:15:29','2026-03-28 10:59:42'),(627,29,'32eb0ba3a428ac0f670c884f1c25945e2d7994fcbabba520f219add46fae5a7f','2026-04-11 11:15:29','2026-03-28 11:20:27','2026-03-28 11:15:29'),(628,29,'bcee638581a7e7358a05aaa1e754c462521d9cffd14e9cb86720c40d8223d6cd','2026-04-11 11:20:27','2026-03-28 12:12:00','2026-03-28 11:20:27'),(629,29,'e59c84c1fc6265958e05947667ad8349bb31810458e57fa38a2df4f25ea38fc2','2026-04-11 12:12:00','2026-03-28 12:12:00','2026-03-28 12:12:00'),(630,29,'af3da63f7f52ce5af88109e894166acf9d87945df86e603a0616b478469f0d5b','2026-04-11 12:12:00',NULL,'2026-03-28 12:12:00'),(631,29,'48e1ec203e19a571dee17662064b798e95b0309fb757b4599f1101c8846aa662','2026-04-11 12:39:11','2026-03-28 13:03:34','2026-03-28 12:39:11'),(632,29,'ae2edfdaa755e66b4a462c2eb91ffa8bc559edc6f0abd67d63dabff8391f6fc9','2026-04-11 13:03:35','2026-03-28 13:03:37','2026-03-28 13:03:34'),(633,29,'c213b14a498f83a3d310c185a0a9975c2d4bb5fd4ad2db4b26bb56f4cc8b9e38','2026-04-11 13:03:38','2026-03-28 13:03:40','2026-03-28 13:03:37'),(634,29,'93bd499fe197dc5c98fae428e9256538d91c267aa44bee71401a4d284236d10a','2026-04-11 13:03:41','2026-03-28 13:03:41','2026-03-28 13:03:40'),(635,29,'d3c0a078f17527ba3f9d34d8cdc77bd3ce38cc2108c1d65073a4dbadf98c76f7','2026-04-11 13:03:42','2026-03-28 13:26:54','2026-03-28 13:03:41'),(636,29,'1f54f5252511acbc0a2f5d210147a270fe677be0d7600aeb3a6111be37d072d2','2026-04-11 13:26:55','2026-03-28 13:27:09','2026-03-28 13:26:54'),(637,29,'2a828adc92cc30c9602f230beded326fe753f802a2a9f945a60b3cb4813aef59','2026-04-11 13:27:09','2026-03-28 13:27:10','2026-03-28 13:27:09'),(638,29,'09fdb1867c00b1bfbd71200c13dd33d00e0d00da7e87d0d33315c6898bc303cd','2026-04-11 13:27:11','2026-03-28 13:27:10','2026-03-28 13:27:10'),(639,29,'fdfd41c4bc4bc13bfb14463a3adcf6ae6097df2a81b9b192388ae4a925a3ebc5','2026-04-11 13:27:11','2026-03-28 13:27:11','2026-03-28 13:27:10'),(640,29,'626c755d691f5479bcb799b2aee83b13c31bab071fdc4d40f91927a9de17fd94','2026-04-11 13:27:11',NULL,'2026-03-28 13:27:11'),(641,1,'62eba6ee4ce530b1f6294a27a7296e7f01d7b636a0af946eec0a6cd044f6f251','2026-04-11 13:27:36','2026-03-28 13:27:39','2026-03-28 13:27:35'),(642,29,'f6fc3b556fce4e4a68003daa510f4b9540bd246f3d83b10dc0f49af918183bb0','2026-04-11 13:29:10','2026-03-28 13:30:15','2026-03-28 13:29:10'),(643,29,'bc0e9b59066b9dcd0d4e79239011755aa54876af454c6200a980b16eab4744d3','2026-04-11 13:30:15','2026-03-28 13:30:20','2026-03-28 13:30:15'),(644,29,'eec8ee31fa19742ece6787655ab0d2bb45dbaac8e16bf3b1115c2b676ebd194f','2026-04-11 13:30:20','2026-03-28 13:31:57','2026-03-28 13:30:20'),(645,29,'8aac606965bee7229a205311001552d590a3d23d80760d3d9bb025a0bca218f6','2026-04-11 13:31:57','2026-03-28 14:17:19','2026-03-28 13:31:57'),(646,29,'59e52dd6d7982341bad0002a9fd5de29ba561851204c96b1f66bda2161eebb5f','2026-04-11 14:17:19','2026-03-28 14:17:19','2026-03-28 14:17:19'),(647,29,'7f8a31ad37c2caac08cd8e132f8d33f6ca45c33d940b80e0d95116d16ed55bd4','2026-04-11 14:17:19','2026-03-28 14:17:19','2026-03-28 14:17:19'),(648,29,'c1b5c274c6e5287c0d0c8b7cd67a1bac5aba3fddccd02e8793fab8d607e68bcb','2026-04-11 14:17:19','2026-03-28 14:21:05','2026-03-28 14:17:19'),(649,29,'2cc832fbff11e486b136a80258f43e08b983d1561723babc5e1c3bad3f979b8b','2026-04-11 14:21:05','2026-03-28 14:23:07','2026-03-28 14:21:05'),(650,29,'247f49708998c6c87f3cd90fbbe98a582483721c50528b98e714f4fd6686c1f5','2026-04-11 14:23:07','2026-03-28 14:23:57','2026-03-28 14:23:07'),(651,29,'a4633afeb123d40f648b8e6609cc8c22f9f5f6125ca1b83d41cbf7ea25ca28a7','2026-04-11 14:23:58','2026-03-28 14:31:15','2026-03-28 14:23:57'),(652,29,'14fd2c7b1d50e8922cb1d696df2e072b61beb28dbfa2a6a233e54ef0ed3781ad','2026-04-11 14:31:16','2026-03-28 14:31:16','2026-03-28 14:31:15'),(653,29,'cb420ea2d099509b0c0f54aad4126ec6cfe1f072eb1c1627a48f2a924d514af8','2026-04-11 14:31:16','2026-03-28 14:31:19','2026-03-28 14:31:16'),(654,29,'6ae3619fb97d2ed1ced916130bae0fa2daf30286186fd5dfea087687f4e745c9','2026-04-11 14:31:19','2026-03-28 14:31:22','2026-03-28 14:31:19'),(655,29,'a712f235a1d346647bf0cff6ffe58c797fdf19129ef01460c651455aa94e2ba2','2026-04-11 14:31:22','2026-03-28 14:47:51','2026-03-28 14:31:22'),(656,29,'322b751fe9d3e7c38ef5903e23ad07fdb545fbd280e1ecf79bea025c7ef24db0','2026-04-11 14:47:52','2026-03-28 14:47:52','2026-03-28 14:47:51'),(657,29,'bb831d9d3d2af081a7751c00fc21c95d8e995f7e1ec7b267626167eb89faed58','2026-04-11 14:47:53','2026-03-28 14:47:53','2026-03-28 14:47:52'),(658,29,'79f5d2df3a51004438a9b0a8021c368bcff957bb5a3e3b25a165f78d97f7450b','2026-04-11 14:47:53','2026-03-28 14:47:57','2026-03-28 14:47:53'),(659,29,'c555558f94ca4d50e08fdbb9d27ea4cfee2e2cecf2a85394049a1a8c7a04e120','2026-04-11 14:47:57','2026-03-28 14:47:58','2026-03-28 14:47:57'),(660,29,'afa269db81654abefb50fe6a05a68a79b561c6d15385a2d123bb442035f8c2c1','2026-04-11 14:47:58','2026-03-28 14:57:25','2026-03-28 14:47:58'),(661,29,'4d53293f4a72aa582394a14e0bd3a5252065451cd44260689a344284bc940679','2026-04-11 14:57:26','2026-03-28 14:57:59','2026-03-28 14:57:25'),(662,29,'ebc09593de189fb58a0fe02dedca9e41d82aee6a8d435cd498c3a1310505b133','2026-04-11 14:58:00','2026-03-28 14:59:15','2026-03-28 14:57:59'),(663,29,'49ab3ec829074ea72a88e52225724eaeee31f9ca3ca28e894cd57d21afa77c07','2026-04-11 14:59:16','2026-03-28 15:16:05','2026-03-28 14:59:15'),(664,29,'7115b0219cbaf2a9652a25511758642a93177e4739401ec78cbd675a913e9789','2026-04-11 15:16:06','2026-03-28 15:23:23','2026-03-28 15:16:05'),(665,29,'0fbc54d1e6996e0e56d3c000fbb6a429292f87d09344bb2926d15d9361518553','2026-04-11 15:23:24','2026-03-28 15:24:10','2026-03-28 15:23:23'),(666,29,'2f63343f8bcf02633c50fcdd7d3c29a4936fe1f2c6f55099748d3492090e1712','2026-04-11 15:24:11','2026-03-28 15:26:20','2026-03-28 15:24:10'),(667,29,'fc6367a535de2176212a1cd364088a899439a01fa3c4ee8f102a1e55912ea556','2026-04-11 15:26:21','2026-03-28 15:27:07','2026-03-28 15:26:20'),(668,29,'f1cb56745919ccf3afeedd81e9948d2465c06f022da93a639f39265bdb435074','2026-04-11 15:27:07','2026-03-28 15:31:49','2026-03-28 15:27:07'),(669,29,'92258e816567eb988c526b2ed4b63351bf250d86437a61bcce936f641dd5c2f9','2026-04-11 15:31:49','2026-03-28 17:00:36','2026-03-28 15:31:49'),(670,29,'a5683e30a415ad70f1e23adb3cb96ed7462c00cae4db45763cfab20df897e663','2026-04-11 17:00:36',NULL,'2026-03-28 17:00:36'),(671,45,'aa7a7ed9f7e0eb69feb28afe62cc3c5e88475f1070e1c92a3243794cf40edf46','2026-04-11 17:07:29','2026-03-28 17:20:15','2026-03-28 17:07:29'),(672,45,'2893bab538ab604752562a6b6cd3b46d6cbad0e31fe9a0611d8f6b6aca74f3e3','2026-04-11 17:20:15',NULL,'2026-03-28 17:20:15');
/*!40000 ALTER TABLE `tbl_refresh_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_resources`
--

DROP TABLE IF EXISTS `tbl_resources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_resources` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `description` text,
  `category` enum('Scripture','Bulletins','Books','Learning','Forms') NOT NULL DEFAULT 'Learning',
  `file_url` varchar(500) NOT NULL,
  `thumbnail_url` varchar(500) DEFAULT NULL,
  `original_filename` varchar(255) DEFAULT NULL,
  `mime_type` varchar(120) DEFAULT NULL,
  `file_size_bytes` bigint DEFAULT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT '1',
  `uploaded_by` int DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_resources_category` (`category`),
  KEY `idx_resources_published` (`is_published`),
  KEY `idx_resources_uploaded_by` (`uploaded_by`),
  CONSTRAINT `fk_resources_uploaded_by` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_resources`
--

LOCK TABLES `tbl_resources` WRITE;
/*!40000 ALTER TABLE `tbl_resources` DISABLE KEYS */;
INSERT INTO `tbl_resources` VALUES (4,'Test schook pdf','Holy Trinity Ethiopian Orthodox Tewahedo Church is a vibrant spiritual community dedicated to preserving our ancient faith while serving our modern world','Learning','http://localhost:5000/uploads/resources/1773432924681-holy_trinity_remaining_scope_final.pdf','http://localhost:5000/uploads/resource-thumbs/1773432924682-download.jpg','Holy_Trinity_Remaining_Scope_Final.pdf','application/pdf',4118,1,1,'2026-03-13 15:15:24','2026-03-13 15:15:24'),(5,'Test pdf book','Holy Trinity Ethiopian Orthodox Tewahedo Church is a vibrant spiritual community dedicated to preserving our ancient faith while serving our modern world. We welcome all who seek to grow in their relationship with God through the rich traditions of Ethiopian Orthodoxy.','Books','http://localhost:5000/uploads/resources/1773444765240-post_devops_exam.pdf','http://localhost:5000/uploads/resource-thumbs/1773444765240-hamsalomi.png','post_devops_exam.pdf','application/pdf',14169,1,1,'2026-03-13 18:32:45','2026-03-13 18:32:45'),(9,'Holy Book','Test','Learning','http://localhost:5000/uploads/resources/1774709126594-church_finance_member_dashboard_scope.pdf',NULL,'church_finance_member_dashboard_scope.pdf','application/pdf',487743,1,NULL,'2026-03-28 09:45:26','2026-03-28 09:45:26');
/*!40000 ALTER TABLE `tbl_resources` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_system_settings`
--

DROP TABLE IF EXISTS `tbl_system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_system_settings` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `section` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_key` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` json NOT NULL,
  `value_type` enum('string','number','boolean','json') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'string',
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tbl_system_settings_section_key` (`section`,`setting_key`),
  KEY `idx_tbl_system_settings_section` (`section`),
  KEY `idx_tbl_system_settings_updated_by` (`updated_by`),
  CONSTRAINT `fk_tbl_system_settings_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `tbl_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=745 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_system_settings`
--

LOCK TABLES `tbl_system_settings` WRITE;
/*!40000 ALTER TABLE `tbl_system_settings` DISABLE KEYS */;
INSERT INTO `tbl_system_settings` VALUES (1,'general','churchName','\"Holy Trinity EOTC\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(2,'general','systemName','\"Holy Trinity Admin Portal\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(3,'general','supportEmail','\"support@holytrinityeotc.org\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(4,'general','contactPhone','\"+1 615) 555-2100\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(5,'general','address','\"123 Church Street, Nashville, TN\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(6,'general','timezone','\"America/Chicago\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(7,'general','dateFormat','\"MM/DD/YYYY\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(8,'general','language','\"English\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(9,'branding','primaryColor','\"#1c4884\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(10,'branding','secondaryColor','\"#0f172a\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(11,'branding','accentColor','\"#f59e0b\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(12,'branding','footerText','\"© Holy Trinity EOTC. All rights reserved.\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(13,'branding','loginWelcomeText','\"Welcome back to the Holy Trinity EOTC admin portal.\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(14,'branding','showPublicBanner','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(15,'branding','publicBannerText','\"Serving faith, family, and community with excellence.\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(16,'access','allowSelfRegistration','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(17,'access','requireEmailVerification','false','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(18,'access','defaultRole','\"member\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(19,'access','forceStrongPassword','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(20,'access','passwordMinLength','12','number',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(21,'access','sessionTimeoutMinutes','30','number',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(22,'access','enableMfaForAdmins','false','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(23,'access','maxLoginAttempts','5','number',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(24,'access','allowFinanceRoleCreation','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(25,'access','allowAdminRoleCreation','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(26,'membership','registrationFee','200','number',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(27,'membership','monthlyDefault','50','number',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(28,'membership','approvalWorkflow','\"manual\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(29,'membership','allowDependents','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(30,'membership','memberIdPrefix','\"M-\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(31,'membership','gracePeriodDays','7','number',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(32,'membership','renewalReminderDays','14','number',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(33,'membership','customHigherAmountAllowed','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(34,'finance','currency','\"USD\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(35,'finance','enableCardPayments','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(36,'finance','enableApplePay','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(37,'finance','enableAch','false','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(38,'finance','coverProcessingFeeDefault','false','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(39,'finance','receiptPrefix','\"RCT-\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(40,'finance','invoicePrefix','\"INV-\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(41,'finance','lateFeeEnabled','false','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(42,'finance','lateFeeAmount','0','number',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(43,'finance','autoGenerateReceipts','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(44,'notifications','senderName','\"Holy Trinity EOTC\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(45,'notifications','senderEmail','\"noreply@holytrinityeotc.org\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(46,'notifications','replyToEmail','\"admin@holytrinityeotc.org\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(47,'notifications','sendWelcomeEmail','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(48,'notifications','sendPaymentReceiptEmail','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(49,'notifications','sendAdminAlerts','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(50,'notifications','newMemberAlertEmail','\"admin@holytrinityeotc.org\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(51,'notifications','backupAlertEmail','\"tech@holytrinityeotc.org\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(52,'integrations','stripeEnabled','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(53,'integrations','stripePublishableKey','\"pk_live_************************\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(54,'integrations','stripeSecretKeyStatus','\"Configured\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(55,'integrations','googleMapsEnabled','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(56,'integrations','googleCalendarEnabled','false','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(57,'integrations','smtpStatus','\"Connected\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(58,'integrations','webhookStatus','\"Healthy\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(59,'maintenance','maintenanceMode','false','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(60,'maintenance','maintenanceMessage','\"We are performing scheduled maintenance. Please check back soon.\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(61,'maintenance','autoBackupEnabled','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(62,'maintenance','backupFrequency','\"daily\"','string',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(63,'maintenance','backupRetentionDays','30','number',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(64,'maintenance','allowRestore','false','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(65,'maintenance','clearCacheOnDeploy','true','boolean',NULL,29,'2026-03-28 11:16:39','2026-03-28 15:34:30'),(288,'branding','logoUrl','\"/src/assets/images/church logo.jpeg\"','string',NULL,29,'2026-03-28 14:57:54','2026-03-28 15:34:30'),(421,'branding','faviconUrl','\"/favicon.ico\"','string',NULL,29,'2026-03-28 15:23:16','2026-03-28 15:34:30'),(440,'membership','planMode','\"settings_driven\"','string',NULL,29,'2026-03-28 15:23:16','2026-03-28 15:34:30');
/*!40000 ALTER TABLE `tbl_system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tbl_users`
--

DROP TABLE IF EXISTS `tbl_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tbl_users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `member_id` bigint unsigned DEFAULT NULL,
  `username` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `full_name` varchar(180) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('admin','finance','member','it','instructor','student') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'member',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `must_change_password` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tbl_users_username` (`username`),
  UNIQUE KEY `uq_tbl_users_email` (`email`),
  KEY `idx_tbl_users_member_id` (`member_id`),
  KEY `idx_tbl_users_role` (`role`),
  KEY `idx_tbl_users_is_active` (`is_active`),
  KEY `idx_tbl_users_must_change_password` (`must_change_password`),
  CONSTRAINT `fk_tbl_users_member_id` FOREIGN KEY (`member_id`) REFERENCES `tbl_members` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tbl_users`
--

LOCK TABLES `tbl_users` WRITE;
/*!40000 ALTER TABLE `tbl_users` DISABLE KEYS */;
INSERT INTO `tbl_users` VALUES (1,1,'nigusea@gmail.com','Nigusea','Dessie','Nigusea Dessie','nigusea@gmail.com','+61645542701','member','$argon2id$v=19$m=19456,t=2,p=1$3wdjkH9oNP6MblT3MEOm5w$/nhnq5awG61tYgZm2HbBNGwRc9UfDFbpA09xT7tFsis',1,0,'2026-03-22 12:09:59','2026-03-26 06:31:14'),(2,2,'abebe@gmail.com','Abebe','Dessie','Abebe Dessie','abebe@gmail.com','+15555555555','member','$argon2id$v=19$m=19456,t=2,p=1$57POkBlUuW7OKfeLAPjQDw$nVwdC1smv62b/Q66wnLDhEXpjwRoR8kgiFogtTALtbY',1,0,'2026-03-22 12:11:09','2026-03-22 12:11:09'),(3,3,'nat12@gmail.com','nati','Tsega','nati Tsega','nat12@gmail.com','+15555555555','member','$argon2id$v=19$m=19456,t=2,p=1$ozFiig8aePTL6ia6TdlI/w$Ce3c1rij+C3xLZUrXRtlVVER6ym5X4C2g8LRhSG2agQ',1,0,'2026-03-22 12:12:31','2026-03-22 12:12:31'),(28,1,'nigusea.finance@church.org','Nigusea','Dessie','Nigusea Dessie','finance@church.org','+15555555555','finance','$argon2id$v=19$m=19456,t=2,p=1$3wdjkH9oNP6MblT3MEOm5w$/nhnq5awG61tYgZm2HbBNGwRc9UfDFbpA09xT7tFsis',1,0,'2026-03-22 19:58:37','2026-03-22 19:58:37'),(29,1,'nigusea.admin@church.org','Nigusea','Dessie','Nigusea Dessie','admin@church.org','+15555555555','admin','$argon2id$v=19$m=19456,t=2,p=1$3wdjkH9oNP6MblT3MEOm5w$/nhnq5awG61tYgZm2HbBNGwRc9UfDFbpA09xT7tFsis',1,0,'2026-03-22 19:58:37','2026-03-22 19:58:37'),(32,6,'mulu@gmail.com','Mulu','Adem','Mulu Adem','mulu@gmail.com','+15555125585','member','$argon2id$v=19$m=19456,t=2,p=1$zKuYOK69NPJOFer6OBFsHQ$dyJB/n9izwy+XtPhr4umH5Phekj0p6a7/KocwqPwvE8',0,0,'2026-03-23 18:58:25','2026-03-23 18:58:25'),(33,7,'maru@gmail.com','Maru','Tsega','Maru Tsega','maru@gmail.com','+15555555555','member','$argon2id$v=19$m=19456,t=2,p=1$sVrifp64AfIwtHym9pGqVA$rxek2oH8rdXskrAPH648laS6w1ntsWRdZ4ux7gdIxyk',1,0,'2026-03-23 19:42:09','2026-03-23 19:42:09'),(34,8,'kal@gmail.com','kal','Adem','kal Adem','kal@gmail.com',NULL,'member','$argon2id$v=19$m=19456,t=2,p=1$34/OY3+AZlq8NIZrYR7Ktg$ewvayUn0H653+/fV19uYbC1YDIWUxmgD2S2S1pVFs24',0,0,'2026-03-23 20:48:40','2026-03-23 20:48:40'),(37,11,'melaku@gmail.com','Melaku','wale','Melaku wale','melaku@gmail.com',NULL,'member','$argon2id$v=19$m=19456,t=2,p=1$eoIgulQnZ2nPaYPF6tSRqw$fIN4N0FcWFq5sBPJQx5JPRtvowszzSPuC/ZB2HKqdOY',1,0,'2026-03-26 06:37:45','2026-03-26 06:37:45'),(38,12,'meseret@gmail.com','Meseret','Adem','Meseret Adem','meseret@gmail.com',NULL,'member','$argon2id$v=19$m=19456,t=2,p=1$nUHrDNFF3Ck9BAjlX+Qb/A$jKY9nhqB9Y4F+ESCIpvirmUdUHGXA8jSrOQyOQakKM8',1,0,'2026-03-26 07:02:37','2026-03-26 07:02:37'),(39,13,'hawa@gmail.com','hawa','Tsega','hawa Tsega','hawa@gmail.com','+15555555555','member','$argon2id$v=19$m=19456,t=2,p=1$qyHpMGJb2oP8USNzrenSLA$MAdjkLej+DvSfY7nMroPb5roUjxfZw7/KnlYhM7IqMM',1,0,'2026-03-26 16:29:24','2026-03-26 16:29:24'),(40,14,'mat@gmail.com','mat','Adem','mat Adem','mat@gmail.com',NULL,'member','$argon2id$v=19$m=19456,t=2,p=1$f2sZqQLO6RI8sD9cnaWPtA$sBvfvcxALp/Eqa8DsW7tXBzkXl9hiMeJye6Vm2VmcRY',1,0,'2026-03-26 17:12:52','2026-03-26 17:12:52'),(41,15,'mek@gmail.com','Mekal','Tsega','Mekal Tsega','mek@gmail.com','+15555555555','member','$argon2id$v=19$m=19456,t=2,p=1$kmW1p43LJp0rhFG5uhmPnQ$eVl2s6lD1hmWmuw26o1QR6fC8I9qkI5ch6snMX83Frk',1,0,'2026-03-26 17:38:16','2026-03-26 17:38:16'),(42,16,'meba@gmail.com','Meba','Tsega','Meba Tsega','meba@gmail.com','+15555551234','member','$argon2id$v=19$m=19456,t=2,p=1$ZaWjZUMexq5SbLenjzY5XA$PJ7HyF18bz+7M05wnAq2OcymlXgD+bCclBLxXiguSfc',1,0,'2026-03-26 20:40:18','2026-03-26 20:40:18'),(43,17,'mamo@gmail.com','mamo','Tsega','mamo Tsega','mamo@gmail.com','+15555555555','member','$argon2id$v=19$m=19456,t=2,p=1$KtvU36tNLQufX5Tewlnc7w$qugKGVK46wQ0pgxt5qLd9tCyF67MRpJaEhPJRCHHWsw',1,0,'2026-03-27 18:48:46','2026-03-27 18:48:46'),(44,18,'nat111@gmail.com','nati','Tsega','nati Tsega','nat111@gmail.com','+15555555555','member','$argon2id$v=19$m=19456,t=2,p=1$7OkQOLvSiVQYEeNVB7dNSg$OVL17oGpHsM1tEcpLmEKpbF+431OX0gNY2ECqqCuJ30',1,0,'2026-03-27 18:56:46','2026-03-27 18:56:46'),(45,20,'buta@gmail.com','buta','Tsega','buta Tsega','buta@gmail.com','+15555555555','member','$argon2id$v=19$m=19456,t=2,p=1$kbtxoXaXDSvooDZ++v5Zdw$vGhx+0KBc4xZPtEGOy4YlZbkaqSHAcaOnMaMkhYMMto',1,0,'2026-03-28 17:07:29','2026-03-28 17:07:29');
/*!40000 ALTER TABLE `tbl_users` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_tbl_users_full_name_bi` BEFORE INSERT ON `tbl_users` FOR EACH ROW BEGIN
  SET NEW.full_name = TRIM(CONCAT(COALESCE(NEW.first_name,''), ' ', COALESCE(NEW.last_name,'')));
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_tbl_users_full_name_bu` BEFORE UPDATE ON `tbl_users` FOR EACH ROW BEGIN
  SET NEW.full_name = TRIM(CONCAT(COALESCE(NEW.first_name,''), ' ', COALESCE(NEW.last_name,'')));
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(80) NOT NULL,
  `last_name` varchar(80) NOT NULL,
  `email` varchar(190) NOT NULL,
  `role` varchar(30) NOT NULL DEFAULT 'member',
  `password_hash` varchar(255) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'wubshet','wubshet','admin@church.org','admin','$2b$10$YXpEsaaSdjUktG4rjNjmD.s7niuaYFfZVMM/5WbME/VsX1zRlWxbe','2025-11-10 14:02:45'),(2,'Finance','Officer','finance@church.org','finance','$2b$10$YXpEsaaSdjUktG4rjNjmD.s7niuaYFfZVMM/5WbME/VsX1zRlWxbe','2025-11-10 14:02:45'),(5,'nati','Tsega','nat12@gmail.com','member','$2a$10$0nKZtCUwjBgLP96b2FquFuwi3mya9BwkTpGICZ5mhrFo8ZMMQAxRy','2025-11-11 17:54:06'),(9,'dessie','nigusea','dessie@gmail.com','admin','$argon2id$v=19$m=19456,t=2,p=1$b/JQnAlzZSjm2T6+DRnzPg$7PHKAz70tnJBfRcSlgX6FqbexxtdPC+xY2gSc5YuASw','2026-02-26 09:54:30'),(11,'Abebe','Abebe','abebe@gmail.com','finance','$argon2id$v=19$m=19456,t=2,p=1$ugs+KNQrXiLSxvq/UA/Blg$ZG4RsRQBJFcb85bjb5eT6TrK98JCItBRVyzVNSyKXKM','2026-02-26 10:15:07');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `vw_finance_member_summary`
--

DROP TABLE IF EXISTS `vw_finance_member_summary`;
/*!50001 DROP VIEW IF EXISTS `vw_finance_member_summary`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `vw_finance_member_summary` AS SELECT 
 1 AS `member_id`,
 1 AS `member_no`,
 1 AS `full_name`,
 1 AS `phone`,
 1 AS `email`,
 1 AS `membership_status`,
 1 AS `total_debits`,
 1 AS `total_credits`,
 1 AS `open_balance`,
 1 AS `total_paid`,
 1 AS `last_payment_at`,
 1 AS `next_due_at`*/;
SET character_set_client = @saved_cs_client;

--
-- Dumping events for database 'holy_trinity'
--

--
-- Dumping routines for database 'holy_trinity'
--
/*!50003 DROP PROCEDURE IF EXISTS `sp_post_invoice_to_ledger` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_post_invoice_to_ledger`(IN p_invoice_id BIGINT UNSIGNED, IN p_actor_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_member_id BIGINT UNSIGNED;
  DECLARE v_member_no VARCHAR(50);
  DECLARE v_full_name VARCHAR(180);
  DECLARE v_phone VARCHAR(40);
  DECLARE v_invoice_number VARCHAR(60);
  DECLARE v_total DECIMAL(12,2);
  DECLARE v_issue_date DATE;
  DECLARE v_running_balance DECIMAL(12,2);

  SELECT
    i.member_id,
    m.member_no,
    m.full_name,
    m.phone,
    i.invoice_number,
    i.total_amount,
    i.issue_date
  INTO
    v_member_id, v_member_no, v_full_name, v_phone, v_invoice_number, v_total, v_issue_date
  FROM tbl_finance_invoices i
  INNER JOIN tbl_members m ON m.id = i.member_id
  WHERE i.id = p_invoice_id
  LIMIT 1;

  SELECT COALESCE(MAX(running_balance), 0.00)
  INTO v_running_balance
  FROM tbl_finance_member_ledger
  WHERE member_id = v_member_id;

  SET v_running_balance = v_running_balance + COALESCE(v_total, 0.00);

  INSERT INTO tbl_finance_member_ledger (
    ledger_uuid,
    member_id,
    member_no,
    full_name_snapshot,
    phone_snapshot,
    record_type,
    related_document_type,
    related_document_id,
    related_document_number,
    record_date,
    description,
    debit_amount,
    credit_amount,
    amount,
    running_balance,
    source,
    source_reference,
    status,
    created_by,
    approved_by
  )
  VALUES (
    UUID(),
    v_member_id,
    v_member_no,
    v_full_name,
    v_phone,
    'invoice',
    'invoice',
    p_invoice_id,
    v_invoice_number,
    CONCAT(v_issue_date, ' 00:00:00'),
    CONCAT('Invoice posted: ', v_invoice_number),
    COALESCE(v_total, 0.00),
    0.00,
    COALESCE(v_total, 0.00),
    v_running_balance,
    'invoice',
    v_invoice_number,
    'posted',
    p_actor_id,
    p_actor_id
  );
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_post_manual_entry_to_ledger` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_post_manual_entry_to_ledger`(IN p_manual_entry_id BIGINT UNSIGNED, IN p_actor_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_member_id BIGINT UNSIGNED;
  DECLARE v_member_no VARCHAR(50);
  DECLARE v_full_name VARCHAR(180);
  DECLARE v_phone VARCHAR(40);
  DECLARE v_entry_number VARCHAR(60);
  DECLARE v_entry_type VARCHAR(30);
  DECLARE v_payment_method VARCHAR(20);
  DECLARE v_amount DECIMAL(12,2);
  DECLARE v_entry_date DATETIME;
  DECLARE v_description VARCHAR(255);
  DECLARE v_running_balance DECIMAL(12,2);

  SELECT
    me.member_id,
    m.member_no,
    m.full_name,
    m.phone,
    COALESCE(me.entry_number, CONCAT('ME-', me.id)),
    me.entry_type,
    me.payment_method,
    me.amount,
    me.entry_date,
    me.description
  INTO
    v_member_id, v_member_no, v_full_name, v_phone, v_entry_number, v_entry_type, v_payment_method, v_amount, v_entry_date, v_description
  FROM tbl_finance_manual_entries me
  INNER JOIN tbl_members m ON m.id = me.member_id
  WHERE me.id = p_manual_entry_id
  LIMIT 1;

  SELECT COALESCE(MAX(running_balance), 0.00)
  INTO v_running_balance
  FROM tbl_finance_member_ledger
  WHERE member_id = v_member_id;

  IF v_entry_type IN ('debit','opening_balance') THEN
    SET v_running_balance = v_running_balance + COALESCE(v_amount, 0.00);

    INSERT INTO tbl_finance_member_ledger (
      ledger_uuid, member_id, member_no, full_name_snapshot, phone_snapshot,
      record_type, related_document_type, related_document_id, related_document_number,
      record_date, description, debit_amount, credit_amount, amount, running_balance,
      source, source_reference, status, created_by, approved_by
    )
    VALUES (
      UUID(), v_member_id, v_member_no, v_full_name, v_phone,
      IF(v_entry_type='opening_balance','opening_balance','manual_entry'),
      'manual_entry', p_manual_entry_id, v_entry_number,
      v_entry_date, v_description, v_amount, 0.00, v_amount, v_running_balance,
      CASE
        WHEN v_payment_method = 'check' THEN 'check'
        WHEN v_payment_method = 'zelle' THEN 'zelle'
        WHEN v_payment_method = 'cash' THEN 'cash'
        WHEN v_payment_method = 'ach' THEN 'ach'
        WHEN v_payment_method = 'card' THEN 'card'
        ELSE 'manual_entry'
      END,
      v_entry_number, 'posted', p_actor_id, p_actor_id
    );
  ELSE
    SET v_running_balance = v_running_balance - COALESCE(v_amount, 0.00);

    INSERT INTO tbl_finance_member_ledger (
      ledger_uuid, member_id, member_no, full_name_snapshot, phone_snapshot,
      record_type, related_document_type, related_document_id, related_document_number,
      record_date, description, debit_amount, credit_amount, amount, running_balance,
      source, source_reference, status, created_by, approved_by
    )
    VALUES (
      UUID(), v_member_id, v_member_no, v_full_name, v_phone,
      'manual_entry',
      'manual_entry', p_manual_entry_id, v_entry_number,
      v_entry_date, v_description, 0.00, v_amount, v_amount, v_running_balance,
      CASE
        WHEN v_payment_method = 'check' THEN 'check'
        WHEN v_payment_method = 'zelle' THEN 'zelle'
        WHEN v_payment_method = 'cash' THEN 'cash'
        WHEN v_payment_method = 'ach' THEN 'ach'
        WHEN v_payment_method = 'card' THEN 'card'
        ELSE 'manual_entry'
      END,
      v_entry_number, 'posted', p_actor_id, p_actor_id
    );
  END IF;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_post_payment_to_ledger` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_post_payment_to_ledger`(IN p_payment_id BIGINT UNSIGNED, IN p_actor_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_member_id BIGINT UNSIGNED;
  DECLARE v_member_no VARCHAR(50);
  DECLARE v_full_name VARCHAR(180);
  DECLARE v_phone VARCHAR(40);
  DECLARE v_payment_number VARCHAR(60);
  DECLARE v_amount DECIMAL(12,2);
  DECLARE v_paid_at DATETIME;
  DECLARE v_method VARCHAR(20);
  DECLARE v_running_balance DECIMAL(12,2);

  SELECT
    p.member_id,
    m.member_no,
    m.full_name,
    m.phone,
    COALESCE(p.payment_number, CONCAT('PAY-', p.id)),
    p.amount,
    COALESCE(p.paid_at, p.created_at),
    p.method
  INTO
    v_member_id, v_member_no, v_full_name, v_phone, v_payment_number, v_amount, v_paid_at, v_method
  FROM tbl_finance_payments p
  INNER JOIN tbl_members m ON m.id = p.member_id
  WHERE p.id = p_payment_id
  LIMIT 1;

  SELECT COALESCE(MAX(running_balance), 0.00)
  INTO v_running_balance
  FROM tbl_finance_member_ledger
  WHERE member_id = v_member_id;

  SET v_running_balance = v_running_balance - COALESCE(v_amount, 0.00);

  INSERT INTO tbl_finance_member_ledger (
    ledger_uuid,
    member_id,
    member_no,
    full_name_snapshot,
    phone_snapshot,
    record_type,
    related_document_type,
    related_document_id,
    related_document_number,
    record_date,
    description,
    debit_amount,
    credit_amount,
    amount,
    running_balance,
    source,
    source_reference,
    status,
    created_by,
    approved_by
  )
  VALUES (
    UUID(),
    v_member_id,
    v_member_no,
    v_full_name,
    v_phone,
    'payment',
    'payment',
    p_payment_id,
    v_payment_number,
    v_paid_at,
    CONCAT('Payment posted: ', v_payment_number),
    0.00,
    COALESCE(v_amount, 0.00),
    COALESCE(v_amount, 0.00),
    v_running_balance,
    CASE
      WHEN v_method = 'check' THEN 'check'
      WHEN v_method = 'zelle' THEN 'zelle'
      WHEN v_method = 'cash' THEN 'cash'
      WHEN v_method = 'ach' THEN 'ach'
      WHEN v_method = 'card' THEN 'card'
      ELSE 'payment'
    END,
    v_payment_number,
    'posted',
    p_actor_id,
    p_actor_id
  );
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Final view structure for view `vw_finance_member_summary`
--

/*!50001 DROP VIEW IF EXISTS `vw_finance_member_summary`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `vw_finance_member_summary` AS select `m`.`id` AS `member_id`,`m`.`member_no` AS `member_no`,`m`.`full_name` AS `full_name`,`m`.`phone` AS `phone`,`m`.`email` AS `email`,`m`.`status` AS `membership_status`,coalesce(sum((case when (`l`.`status` in ('posted','approved')) then `l`.`debit_amount` else 0 end)),0.00) AS `total_debits`,coalesce(sum((case when (`l`.`status` in ('posted','approved')) then `l`.`credit_amount` else 0 end)),0.00) AS `total_credits`,coalesce((sum((case when (`l`.`status` in ('posted','approved')) then `l`.`debit_amount` else 0 end)) - sum((case when (`l`.`status` in ('posted','approved')) then `l`.`credit_amount` else 0 end))),0.00) AS `open_balance`,coalesce((select sum(`p`.`amount`) from `tbl_finance_payments` `p` where ((`p`.`member_id` = `m`.`id`) and (`p`.`status` in ('approved','paid')))),0.00) AS `total_paid`,(select max(`p`.`paid_at`) from `tbl_finance_payments` `p` where ((`p`.`member_id` = `m`.`id`) and (`p`.`status` in ('approved','paid')))) AS `last_payment_at`,(select min(`i`.`due_date`) from `tbl_finance_invoices` `i` where ((`i`.`member_id` = `m`.`id`) and (`i`.`status` in ('issued','partially_paid','overdue')) and (`i`.`balance_due` > 0))) AS `next_due_at` from (`tbl_members` `m` left join `tbl_finance_member_ledger` `l` on((`l`.`member_id` = `m`.`id`))) group by `m`.`id`,`m`.`member_no`,`m`.`full_name`,`m`.`phone`,`m`.`email`,`m`.`status` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-28 18:59:55
