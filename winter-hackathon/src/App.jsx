import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [port, setPort] = useState(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const readerRef = useRef(null);
  const writerRef = useRef(null);

  // ESP32 연결
  const connectESP32 = async () => {
    try {
      const selectedPort = await navigator.serial.requestPort();
      await selectedPort.open({ baudRate: 115200 });
      
      setPort(selectedPort);
      setConnected(true);
      
      const textDecoder = new TextDecoderStream();
      selectedPort.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      readerRef.current = reader;
      
      const textEncoder = new TextEncoderStream();
      const writer = textEncoder.writable.getWriter();
      writerRef.current = writer;
      textEncoder.readable.pipeTo(selectedPort.writable);
      
      readLoop(reader);
      
    } catch (error) {
      console.error('연결 실패:', error);
      alert('ESP32 연결 실패!');
    }
  };

  // 데이터 수신
  const readLoop = async (reader) => {
    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.type === 'status') {
                setStatus(data.state);
                setElapsed(data.elapsed || 0);
              }
            } catch (e) {
              console.log('수신:', line);
            }
          }
        }
      }
    } catch (error) {
      console.error('읽기 오류:', error);
    }
  };

  const sendCommand = async (cmd) => {
    if (!writerRef.current) return;
    await writerRef.current.write(cmd + '\n');
  };

  const handleInspect = () => {
    sendCommand('INSPECT');
  };

  const handleStop = () => {
    sendCommand('STOP');
  };

  const getStatusText = () => {
    switch (status) {
      case 'idle': return '대기 중';
      case 'forward': return '정방향 회전 중';
      case 'paused': return '일시 정지';
      case 'reverse': return '역방향 회전 중';
      default: return '알 수 없음';
    }
  };

  const getProgress = () => {
    if (status === 'forward') {
      return Math.min((elapsed / 5000) * 33, 33);
    } else if (status === 'paused') {
      return 33 + Math.min((elapsed / 3000) * 33, 33);
    } else if (status === 'reverse') {
      return 66 + Math.min((elapsed / 5000) * 34, 34);
    }
    return 0;
  };

  const isInspecting = status === 'forward' || status === 'paused' || status === 'reverse';

  return (
    <div className="app">
      <div className="container">
        <h1 className="title">항만 점검 시스템</h1>
        
        {!connected ? (
          <button className="btn btn-connect" onClick={connectESP32}>
            ESP32 연결
          </button>
        ) : (
          <>
            <div className="status-box">
              <span className="status-label">상태:</span>
              <span className={`status-value ${status}`}>
                {getStatusText()}
              </span>
            </div>

            {isInspecting && (
              <div className="progress-container">
                <div className="progress-bar" style={{ width: `${getProgress()}%` }}>
                  <span className="progress-text">{Math.round(getProgress())}%</span>
                </div>
              </div>
            )}

            <div className="button-container">
              <button
                className="btn btn-inspect"
                onClick={handleInspect}
                disabled={isInspecting}
              >
                {isInspecting ? '점검 진행 중...' : '점검 시작'}
              </button>

              <button className="btn btn-stop" onClick={handleStop}>
                중지
              </button>
            </div>

            <div className="info">
              <div className="sequence">
                <div className={`seq-item ${status === 'forward' ? 'active' : ''}`}>
                  정방향 5초
                </div>
                <div className={`seq-item ${status === 'paused' ? 'active' : ''}`}>
                  정지 3초
                </div>
                <div className={`seq-item ${status === 'reverse' ? 'active' : ''}`}>
                  역방향 5초
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;