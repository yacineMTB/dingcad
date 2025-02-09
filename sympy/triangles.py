import sympy as sp
import matplotlib.pyplot as plt
import numpy as np

# 1) Define known points as Sympy Points
A = sp.Point(0, 0)
B = sp.Point(7, 0)
D = sp.Point(0, -8)
C = sp.Point(2, -1)

# 2) Solve for h = (x_h, y_h)
x_h = 0.5
y_h = sp.Symbol('y_h', real=True)

# Equation of line D->B => 8x - 7y - 56 = 0
# Distance from (x_h,y_h) to that line = 0.5
expr_h = abs(8*x_h - 7*y_h - 56)/sp.sqrt(8**2 + (-7)**2) - 0.5

sol_y_h = sp.solve(sp.Eq(expr_h, 0), y_h)
y_candidates_h = []
for candidate in sol_y_h:
    y_candidates_h.append((candidate, candidate.evalf()))

y_h_chosen = [c for c in y_candidates_h if c[1] > -8 and c[1] < -6][0][1]
H = sp.Point(x_h, y_h_chosen)

# 3) Solve for e
x_e = sp.Symbol('x_e', real=True)
y_e = -1

expr_e = 8*x_e - 7*y_e - 56 + 0.5*sp.sqrt(113)
sol_x_e = sp.solve(sp.Eq(expr_e, 0), x_e)
E = sp.Point(sol_x_e[0], y_e)

# 4) Calculate G (projection of C onto EH)
CE = C - E
EH = H - E
t = CE.dot(EH)/EH.dot(EH)
G = E + t*EH

# 5) Calculate I and J around G
EH_vector = H - E
EH_length = sp.sqrt((H.x - E.x)**2 + (H.y - E.y)**2).evalf()
EH_unit_vector = sp.Point((H.x - E.x)/EH_length, (H.y - E.y)/EH_length)

# Place I and J 0.25 units on either side of G
I = G - EH_unit_vector * 0.0
J = G + EH_unit_vector * 0.5

# 6) Calculate K and L parallel to EH
K = C + EH_unit_vector * 0.0
L = C + EH_unit_vector * 0.5

def plot_points_and_lines():
    plt.figure(figsize=(10, 10))
    
    # Plot points
    points = {
        'A': A,
        'B': B,
        'D': D,
        # 'C': C,
        'H': H,
        'E': E,
        # 'G': G,
        'I': I,
        'J': J,
        'K': K,
        'L': L
    }
    
    # Plot all points
    for label, point in points.items():
        x = float(point.x.evalf())
        y = float(point.y.evalf())
        plt.plot(x, y, 'o', markersize=8, label=label)
        plt.annotate(label, (x, y), xytext=(5, 5), textcoords='offset points')

    # Plot lines
    plt.plot([float(A.x), float(B.x)], [float(A.y), float(B.y)], 'b-', label='AB')
    plt.plot([float(B.x), float(D.x)], [float(B.y), float(D.y)], 'b-', abel='BD')
    plt.plot([float(D.x), float(A.x)], [float(D.y), float(A.y)], 'b-', label='DA')
    
    # Additional lines
    plt.plot([float(E.x), float(H.x)], [float(E.y), float(H.y)], 'r-', label='EH')
    plt.plot([float(I.x), float(J.x)], [float(I.y), float(J.y)], 'g-', label='IJ')
    plt.plot([float(K.x), float(L.x)], [float(K.y), float(L.y)], 'm-', label='KL')
    plt.plot([float(C.x), float(G.x)], [float(C.y), float(G.y)], 'k--', label='CG')

    plt.axis('equal')
    plt.grid(True)
    plt.xlabel('x')
    plt.ylabel('y')
    plt.title('Triangle Construction with I, J, K, and L')
    plt.xlim(-1, 8)
    plt.ylim(-9, 1)
    plt.legend()
    plt.show()



# Plot points
for point, coords in [('A', A), ('B', B), ('D', D), ('C', C), ('H', H), ('E', E), ('G', G), ('I', I), ('J', J), ('K', K), ('L', L)]:
    x = float(coords.x.evalf())
    y = float(coords.y.evalf())
    print(f"Point {point}: ({x:.10f}, {y:.10f})")



# Call the plotting function
plot_points_and_lines()
