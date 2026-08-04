# Future Enhancements & Ideas

This document outlines the strategic roadmap for scaling and improving the AI Architect platform beyond its current capabilities.

## 1. Real-time 3D WebGL Visualization
- **Description:** Upgrade the current 2D SVG Blueprint Editor to include an interactive 3D view.
- **Implementation:** Use `Three.js` or `React Three Fiber` to instantly extrude the 2D room coordinates into 3D spaces with procedural walls, doors, and floors, enabling an interactive "walkthrough" mode.

## 2. Municipal Bylaw Compliance Engine
- **Description:** Extend the deterministic rules engine beyond traditional Vastu Shastra to support localized governmental building codes.
- **Implementation:** Add configurable modules for minimum setback distances, maximum floor area ratios (FAR), and required fire-escape routing.

## 3. Advanced Non-Rectangular Geometry
- **Description:** Currently, the system strictly generates orthogonal, rectangular rooms.
- **Implementation:** Upgrade the coordinate schema and the LLM CoT prompt to understand and output multi-point polygons. This will allow the generation of L-shaped, T-shaped, or diagonal/radial architectural features.

## 4. Deterministic Furniture Collision Engine
- **Description:** The system currently relies entirely on the LLM to place furniture within room boundaries, which can occasionally lead to overlapping items.
- **Implementation:** Implement a secondary 2D bounding-box collision detection algorithm in the FastAPI backend that runs after the room clamping stage. It will automatically nudge or remove furniture coordinates that overlap or block doors.

## 5. Local Model Fine-Tuning (Latency Reduction)
- **Description:** Reduce the current ~6-second API latency caused by querying a massive 70B model over the network.
- **Implementation:** Fine-tune a smaller, highly specialized local model (e.g., Llama-3-8B) on a proprietary dataset of high-quality JSON floor plan coordinates. This eliminates the reliance on the Hugging Face Inference API and allows for near-instant, private local generation.
