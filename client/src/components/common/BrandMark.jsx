import logo from '../../assets/logo/fzac-logo.jpg';
import './BrandMark.css';

export const BrandMark = ({ compact = false }) => {
  return (
    <div className={`brand-mark ${compact ? 'brand-mark--compact' : ''}`}>
      <img className="brand-mark__logo" src={logo} alt="Materiales FZAC" />

      {!compact && (
        <span className="brand-mark__copy">
          <strong>Materiales FZAC</strong>
          <small>Tienda de materiales</small>
        </span>
      )}
    </div>
  );
};

export default BrandMark;
