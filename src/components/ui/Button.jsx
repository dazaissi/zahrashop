export default function Button({ children, variant = 'primary', className = '', ...props }) {
  const baseStyle = "btn-action";
  const variants = {
    primary: "btn-action-primary",
    success: "btn-action-green",
    warning: "btn-action-warning",
    danger: "btn-action-delete",
    secondary: "btn-action-edit",
    solid: "btn-primary" // Tombol besar (simpan, export, dll)
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}