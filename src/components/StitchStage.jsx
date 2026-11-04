import { AlertIcon } from './ui-icons.jsx';

const StitchStage = ({
    canvasRef,
    isGenerating,
    error,
    canvasUrl,
    output,
    previewMode,
    onRetry
}) => {
    const showPreview = Boolean(canvasUrl) && !error;

    return (
        <div className="stage" aria-busy={isGenerating} data-preview-mode={previewMode}>
            <canvas ref={canvasRef} className="hidden-canvas" />
            <div className="stage-ticks" aria-hidden="true">
                <span /><span /><span /><span />
            </div>

            {isGenerating && !canvasUrl && (
                <div className="stage-status">
                    <span className="stage-progress" aria-hidden="true"><span /></span>
                    <p>正在拼接…</p>
                </div>
            )}

            {isGenerating && canvasUrl && (
                <div className="stage-refreshing" role="status">
                    <span className="stage-progress" aria-hidden="true"><span /></span>
                    <span>更新中…</span>
                </div>
            )}

            {!isGenerating && error && (
                <div className="stage-error" role="alert">
                    <AlertIcon />
                    <p>{error}</p>
                    <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
                        重试
                    </button>
                </div>
            )}

            {showPreview && (
                <img
                    src={canvasUrl}
                    alt={output ? `拼接结果预览，${output.width} × ${output.height} 像素` : '拼接结果预览'}
                    className="result-image"
                    width={output?.width}
                    height={output?.height}
                />
            )}
        </div>
    );
};

export default StitchStage;
