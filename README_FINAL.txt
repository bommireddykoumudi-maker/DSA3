ROUTEFLOW - DELIVERY ROUTE OPTIMIZER
Final demo build

1. BACKEND
Open PowerShell in backend and run:
  python -m venv venv
  venv\Scripts\activate
  pip install -r requirements.txt
  python app.py

2. FRONTEND
Open a second PowerShell in the project root and run:
  python -m http.server 5500
Then open:
  http://localhost:5500

3. WORKFLOW
Add delivery locations, package weights and customer delivery windows in the Deliveries page.
Add/remove vehicles and capacities in the Vehicles page.
Click Optimize Routes.
The frontend sends the input to Flask.
The backend assigns deliveries by capacity, represents the network as a weighted adjacency-list graph, applies the Nearest Neighbor heuristic, checks capacity/time-window feasibility, and calculates distance, completion time and fuel.

4. DEMO LOCATIONS
Hafeezpet, Miyapur, Kondapur, Gachibowli, Madhapur.
The distances are project-network values for the DSA demonstration, not live map/traffic distances.

5. AUTOMATIC METRICS
Travel time is calculated at 40 km/h.
Fuel is calculated at 15 km/L.
Dashboard completion time is the slowest active vehicle's finish time because vehicles operate in parallel.
Total fuel is the sum across active vehicles.

6. DSA
Weighted graph (adjacency list) + Nearest Neighbor heuristic + capacity-constrained vehicle assignment + constraint validation.
