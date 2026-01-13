# Blockchain-Based Security Prototype for Smart Water Infrastructure

## Overview

This repository contains a **fully functional prototype** demonstrating how **blockchain technology** can be used to enhance **security, integrity, traceability, and accountability** in **smart water infrastructures**.

The prototype is designed for **academic research (PhD level)** and focuses on the **water sector (SCADA/ICS)** within **smart cities**.  
It deliberately avoids integrating blockchain into real-time hydraulic control loops and instead uses it as a **trust, audit, and governance layer**.

---

## Research Motivation

Water infrastructures (pumping stations, distribution networks, treatment plants) are critical cyber-physical systems.  
Traditional centralized SCADA security mechanisms suffer from:

- Limited **non-repudiation**
- Weak **cross-organizational trust**
- Difficulty in **post-incident forensic reconstruction**
- Vulnerability to **log tampering and insider threats**

Blockchain provides strong guarantees of **immutability, traceability, and accountability**, but must be used carefully due to latency and performance constraints.

This prototype demonstrates a **hybrid on-chain / off-chain architecture** suitable for the water sector.

---

## Key Design Principles

- ❌ Blockchain is **NOT** used for real-time control
- ✅ Blockchain is used for:
  - Immutable audit trail
  - Event accountability
  - Governance and compliance
- ✅ High-frequency telemetry remains **off-chain**
- ✅ Only **critical events** are anchored on-chain
- ✅ Integrity is ensured using **SHA-256 hash anchoring**
- ✅ Roles are enforced using **permissioned smart contracts**



