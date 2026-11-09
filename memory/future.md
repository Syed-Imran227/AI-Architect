# Future Roadmap & Vision (AI Architect V3 & Beyond)

## 1. Industry Foundation Classes (IFC / openBIM) Export
- **Goal:** Enable frictionless interoperability with Autodesk Revit, Graphisoft ArchiCAD, and BlenderBIM.
- **Implementation Strategy:**
  - Leverage `IfcOpenShell` in the backend export suite (`backend/exporters/ifc_exporter.py`).
  - Map `CanonicalBuildingDocument` entities directly to IFC4 classes:
    - `CanonicalFloor` $\rightarrow$ `IfcBuildingStorey`
    - `CanonicalWallSegment` $\rightarrow$ `IfcWallStandardCase`
    - `CanonicalOpening` (door/window) $\rightarrow$ `IfcDoor` / `IfcWindow`
    - `CanonicalRoom` $\rightarrow$ `IfcSpace`
    - `CanonicalFurnitureItem` $\rightarrow$ `IfcFurnishingElement`
  - Embed material properties (brickwork, glass, reinforced concrete) and structural thermal transmittance values ($U$-values).

## 2. Municipal Sanction & Authority Submission Engine
- **Goal:** One-click generation of statutory sanction drawings compliant with local building bylaws (e.g., BBMP/BDA Bangalore, DDA Delhi, BMC Mumbai).
- **Features:**
  - Automated generation of standard municipal drawing sheets (A1 size, 1:100 scale).
  - Mandatory municipal title blocks, key plans, site setback tables, and FAR calculations.
  - Automated septic tank, rainwater harvesting pit, and parking layout compliance checks.

## 3. Computer Vision: Sketch-to-Vector & Site-Plan Digitization
- **Goal:** Allow architects and clients to upload a hand-drawn napkin sketch or real-estate marketing brochure and automatically convert it into a `CanonicalBuildingDocument`.
- **Implementation Strategy:**
  - Integrate multimodal vision models (Gemini 3.1 Pro Multimodal / DeepSeek-VL) to extract room labels, adjacencies, and dimensions.
  - Pipe extracted topological graphs into the deterministic drafter (`intelligent_generator.py`) to synthesize an aligned, buildable CAD blueprint.

## 4. Physics-Based Whole-Building Energy Simulation (BPS)
- **Goal:** Predict annual kilowatt-hour (kWh) electrical and HVAC consumption directly from the floor plan.
- **Features:**
  - Couple the `sunlight_engine.py` solar daylighting calculations with dynamic degree-day heat gain models.
  - Suggest energy-saving architectural modifications (e.g., deep south overhangs, louvers, high thermal mass external walls).

## 5. Structural Engineering Preliminary Sizing (Eurocode / IS 456)
- **Goal:** Provide preliminary column and beam sizing directly on the 2D blueprint and 3D massing model.
- **Features:**
  - Automatic column placement at wall intersections and spans exceeding 15 ft.
  - Tributary load area computation to estimate axial column loads for foundation budgeting.
