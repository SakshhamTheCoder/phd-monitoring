const predefinedColors = [
  "#F94144", // Soft Red
  "#F3722C", // Warm Orange
  "#F9C74F", // Golden Yellow
  "#90BE6D", // Mellow Green
  "#43AA8B", // Teal
  "#577590", // Muted Blue
  "#277DA1", // Deep Blue
  "#9D4EDD", // Violet
  "#FF6F91", // Coral Pink
  "#6A4C93"  // Dark Purple
]

  
  const generateColorFromInitials = (initials) => {
    let hash = 0;
    for (let i = 0; i < initials.length; i++) {
      hash = initials.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Use the hash to select a color from the predefined array
    const colorIndex = Math.abs(hash) % predefinedColors.length;
    return predefinedColors[colorIndex];
  };
  

  
  
  // Function to create an image with initials and background color
  export const generateAvatar = (firstName, lastName) => {
    firstName = firstName || ""; // Guard against undefined/null (e.g. user not loaded yet)
    if( !lastName) {
      if(firstName && firstName.length>4)
      lastName = firstName[4] || ""; // Handle cases where last name is not provided
      else
        lastName="P"
    }
    const initials = `${firstName[0] || "U"}${lastName[0] || ""}`.toUpperCase();
    const bgColor = generateColorFromInitials(initials);
    const canvas = document.createElement("canvas");
    const size = 100;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
  
    // Draw background
    context.fillStyle = bgColor;
    context.fillRect(0, 0, size, size);
  
    // Draw initials
    context.font = "bold 40px Arial";
    context.fillStyle = "white";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(initials, size / 2, size / 2);
  
    // Return data URL
    return canvas.toDataURL("image/png");
  };
  
