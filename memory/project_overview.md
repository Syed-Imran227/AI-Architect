# AI Architect: Project Overview

## What is AI Architect?
AI Architect is a dual-pipeline generative platform that converts natural language requirements into mathematically precise 2D architectural floor plan coordinate sets. It combines the generative capabilities of Large Language Models (LLMs) with deterministic coordinate bounding and rule-based constraint solving.

## Key Features
- **Generative AI Layout Engine:** Uses Llama-3-70B via Hugging Face with Chain-of-Thought (CoT) prompting to generate JSON-based room coordinates.
- **Vastu Shastra Compliance:** Features a deterministic 10-rule geometric scoring engine to evaluate spatial layouts against traditional South Asian Vastu guidelines.
- **Auto-Fix Correction Loop:** Automatically identifies Vastu violations and feeds targeted feedback back into the LLM to recursively correct layout issues, achieving high convergence.
- **Interactive SVG Blueprint Editor:** A React 19 drag-and-drop canvas allowing 60FPS fluid modifications of generated layouts.
- **AutoCAD DXF Exporter:** Backend pipeline using `ezdxf` to export JSON layouts directly into multi-layered AutoCAD DXF format (WALLS, LABELS, DOORS, DIMENSIONS) at a 1:1 real-world scale.
- **Cloud Persistence & Security:** Uses MongoDB Atlas for session saving and Python-Jose for stateless JWT token authentication.
