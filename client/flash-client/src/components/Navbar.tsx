import { useState, useEffect } from "react";
import React from "react";

// If you are using React Router, uncomment these lines:
// import { Link, useNavigate, useLocation } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

export default function Navbar() {
  // Use a more descriptive state for hover, and a separate one for active route
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string>('');

  // If using React Router:
  // const navigate = useNavigate();
  // const location = useLocation();

  useEffect(() => {
    // If using React Router, uncomment this:
    // setActivePath(location.pathname);

    // For demonstration without React Router, set active path based on current window location
    const currentPath = window.location.pathname;
    const matchingItem = navItems.find(item => item.to === currentPath);
    if (matchingItem) {
      setActivePath(matchingItem.to);
    } else {
      // Fallback for root or unmatched paths
      setActivePath('/');
    }
  }, []); // Add location.pathname to dependency array if using React Router

  const navItems: NavItem[] = [
    { to: "/", label: "Home", icon: "🏠" },
    { to: "/roadmap", label: "Roadmap Mentor", icon: "🗺️" },
    { to: "/skills", label: "Skill Center", icon: "🎯" },
    { to: "/communication", label: "Communication Coach", icon: "💬" },
    { to: "/tech", label: "Tech Radar", icon: "📡" },
    { to: "/optimize", label: "Code Optimizer", icon: "⚡" },
    { to: "/resume", label: "CV Scanner", icon: "📄" }
  ];

  const handleNavClick = (to: string) => {
    // console.log(`Navigating to: ${to}`);
    // If using React Router, uncomment this line:
    // navigate(to);

    // For now, using window.location for demonstration.
    // Remove this line and uncomment the navigate(to) above when using react-router.
    window.location.href = to;
  };

  // Define keyframes within JavaScript objects where possible or keep them in the <style> block
  // Using a single style object for clarity, but for production, CSS modules are recommended.
  const styles: { [key: string]: React.CSSProperties } = {
    nav: {
      position: 'relative',
      background: 'linear-gradient(135deg, #1A202C 0%, #6D28D9 50%, #1A202C 100%)', // Darker base, vibrant center
      backdropFilter: 'blur(25px)', // Slightly more blur
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)', // Finer border
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)', // Deeper shadow
      zIndex: 1000,
      overflow: 'hidden', // Contain particle animations
    },
    backgroundGlow: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(45deg, rgba(124, 58, 237, 0.3), rgba(236, 72, 153, 0.2), rgba(59, 130, 246, 0.2))',
      animation: 'pulse 4s ease-in-out infinite alternate', // Slower, alternating pulse
      pointerEvents: 'none', // Ensure it doesn't block clicks
    },
    container: {
      position: 'relative',
      maxWidth: '100%', // Full width
      margin: '0 auto',
      padding: '18px 30px', // More padding
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '20px', // Add a gap for responsiveness on smaller screens
    },
    brand: {
      display: 'flex',
      alignItems: 'center',
      gap: '14px', // Increased gap
      flexShrink: 0, // Prevent brand from shrinking too much
    },
    logo: {
      width: '44px', // Larger logo
      height: '44px',
      background: 'linear-gradient(135deg, #8B5CF6, #EC4899)', // Brighter gradient
      borderRadius: '14px', // More rounded
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 6px 20px rgba(139, 92, 246, 0.5)', // Enhanced shadow
      fontSize: '22px', // Larger icon
      color: '#FFFFFF',
      textShadow: '0 1px 3px rgba(0,0,0,0.3)',
    },
    brandText: {
      fontSize: '26px', // Larger font
      fontWeight: 'extrabold', // Even bolder
      background: 'linear-gradient(45deg, #A78BFA, #F472B6)', // Brighter text gradient
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      letterSpacing: '0.5px', // Subtle letter spacing
    },
    navLinks: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px', // Reduced gap significantly
      flexWrap: 'nowrap', // Try to keep on one line if possible
      justifyContent: 'flex-end',
      maxWidth: '100%',
      overflowX: 'auto', // Allow scrolling if it really overflows
      paddingBottom: '4px' // Space for scrollbar if needed
    },
    navButton: {
      position: 'relative',
      padding: '8px 14px', // Reduced padding
      borderRadius: '12px',
      border: 'none',
      background: 'transparent',
      color: 'rgba(255, 255, 255, 0.85)',
      cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      alignItems: 'center',
      gap: '6px', // Reduced gap between icon and text
      fontSize: '14px', // Reduced font size
      fontWeight: '600',
      whiteSpace: 'nowrap', // Prevent text wrapping
      textDecoration: 'none',
      boxShadow: 'inset 0 0 0 0 transparent',
    },
    navButtonHover: {
      background: 'rgba(255, 255, 255, 0.18)', // More opaque on hover
      backdropFilter: 'blur(12px)',
      color: 'white',
      transform: 'translateY(-3px) scale(1.02)', // More pronounced lift and slight scale
      boxShadow: 'inset 0 0 15px rgba(255, 255, 255, 0.1), 0 5px 15px rgba(0, 0, 0, 0.2)', // Subtle inner and outer shadow on hover
    },
    navButtonActive: {
      background: 'rgba(255, 255, 255, 0.25)', // Even more opaque when active
      backdropFilter: 'blur(15px)',
      color: 'white',
      transform: 'translateY(-1px) scale(1.01)', // Subtle lift for active
      boxShadow: 'inset 0 0 20px rgba(255, 255, 255, 0.15), 0 3px 10px rgba(0, 0, 0, 0.15)',
    },
    glowEffect: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(45deg, rgba(139, 92, 246, 0.4), rgba(236, 72, 153, 0.4))', // More vibrant glow
      borderRadius: '16px', // Match button border-radius
      opacity: 0,
      transition: 'opacity 0.4s ease, filter 0.4s ease',
      filter: 'blur(5px)', // More blur for a softer glow
      pointerEvents: 'none',
    },
    icon: {
      fontSize: '22px', // Larger icon
      transition: 'transform 0.2s ease',
    },
    iconHover: {
      transform: 'scale(1.2)', // More pronounced icon scale on hover
    },
    activeIndicator: {
      position: 'absolute',
      bottom: '2px', // Closer to bottom for active state
      left: '50%',
      transform: 'translateX(-50%)',
      width: '0',
      height: '4px', // Thicker indicator
      background: 'linear-gradient(90deg, #A78BFA, #F472B6)', // Brighter gradient
      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      borderRadius: '2px',
    },
    particles: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
    },
    particle1: {
      position: 'absolute',
      top: '50%',
      left: '20%',
      width: '12px', // Larger particle
      height: '12px',
      background: 'rgba(167, 139, 250, 0.6)', // More opaque
      borderRadius: '50%',
      animation: 'ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite',
    },
    particle2: {
      position: 'absolute',
      top: '30%',
      right: '25%',
      width: '8px', // Larger particle
      height: '8px',
      background: 'rgba(244, 114, 182, 0.7)', // More opaque
      borderRadius: '50%',
      animation: 'pulse-particle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite alternate', // New animation for more movement
    },
    particle3: {
      position: 'absolute',
      bottom: '25%',
      left: '60%',
      width: '10px', // Larger particle
      height: '10px',
      background: 'rgba(99, 102, 241, 0.6)', // More opaque blue/purple
      borderRadius: '50%',
      animation: 'bounce 1.5s infinite',
    }
  };

  // Combine common button styles
  const getNavButtonStyles = (itemPath: string) => {
    const isHovered = hoveredItem === itemPath;
    const isActive = activePath === itemPath;

    return {
      ...styles.navButton,
      ...(isHovered ? styles.navButtonHover : {}),
      ...(isActive ? styles.navButtonActive : {}),
      // Ensure hover styles override active when actively hovering an active item
      ...(isActive && isHovered ? styles.navButtonHover : {}),
    };
  };

  return (
    <>
      <style>{`
        /* Keyframes for animations */
        @keyframes pulse {
          0% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
          100% { opacity: 0.7; transform: scale(1); }
        }
        @keyframes ping {
          0% { transform: scale(0.5); opacity: 0.8; }
          75%, 100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
        @keyframes pulse-particle {
          0% { transform: scale(0.8) translateY(0); opacity: 0.7; }
          50% { transform: scale(1.2) translateY(-5px); opacity: 1; }
          100% { transform: scale(0.8) translateY(0); opacity: 0.7; }
        }
        @keyframes bounce {
          0%, 100% {
            transform: translateY(-25%);
            animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
          }
          50% {
            transform: translateY(0);
            animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
          }
        }

        /* Media queries for responsiveness */
        @media (max-width: 900px) {
            .nav-links {
                gap: 8px !important;
                justify-content: center !important; /* Center buttons when wrapping */
            }
            .nav-button {
                padding: 10px 18px !important;
                font-size: 15px !important;
                gap: 8px !important;
            }
            .nav-button .icon {
                font-size: 20px !important;
            }
            .brand-text {
                font-size: 22px !important;
            }
            .logo {
                width: 40px !important;
                height: 40px !important;
                font-size: 20px !important;
            }
            .container {
                padding: 16px 20px !important;
                flex-wrap: wrap; /* Allow container to wrap on smaller screens */
                justify-content: center; /* Center content when wrapped */
            }
        }

        @media (max-width: 600px) {
            .nav-links {
                flex-direction: column; /* Stack buttons vertically */
                width: 100%; /* Take full width */
                gap: 6px !important;
                align-items: stretch; /* Stretch buttons to fill width */
            }
            .nav-button {
                padding: 10px !important;
                justify-content: center; /* Center text and icon */
                font-size: 16px !important;
            }
            .container {
                flex-direction: column; /* Stack brand and nav links */
                align-items: center; /* Center items in column layout */
                padding: 12px 15px !important;
            }
            .brand {
                margin-bottom: 15px; /* Space between brand and stacked links */
            }
            .background-glow {
                display: none; /* Hide complex glow on very small screens for performance */
            }
            .particles div {
                display: none; /* Hide particles on very small screens for performance */
            }
        }
      `}</style>

      <nav style={styles.nav}>
        <div style={styles.backgroundGlow}></div>

        <div className="container" style={styles.container}>
          <div style={styles.brand}>
            <div className="logo" style={styles.logo}>
              <span>⚡</span>
            </div>
            <span className="brand-text" style={styles.brandText}>Flash</span>
          </div>

          <div className="nav-links" style={styles.navLinks}>
            {navItems.map((item) => {
              const isHovered = hoveredItem === item.to;
              const isActive = activePath === item.to;

              return (
                <button
                  key={item.to}
                  onClick={() => {
                    handleNavClick(item.to);
                    setActivePath(item.to); // Update active path on click
                  }}
                  className="nav-button"
                  style={getNavButtonStyles(item.to)}
                  onMouseEnter={() => setHoveredItem(item.to)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div
                    className="glow"
                    style={{
                      ...styles.glowEffect,
                      opacity: isHovered || isActive ? 1 : 0,
                    }}
                  ></div>
                  <span
                    className="icon"
                    style={{
                      ...styles.icon,
                      transform: isHovered ? styles.iconHover.transform : 'scale(1)',
                    }}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  <div
                    className="indicator"
                    style={{
                      ...styles.activeIndicator,
                      width: isActive ? 'calc(100% - 20px)' : (isHovered ? 'calc(100% - 20px)' : '0'),
                    }}
                  ></div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={styles.particles}>
          <div style={styles.particle1}></div>
          <div style={styles.particle2}></div>
          <div style={styles.particle3}></div>
        </div>
      </nav>
    </>
  );
}