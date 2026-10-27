import type { RunState, ViewSettings } from './model.ts';
import { trafficSoundLevels } from './police-presentation.ts';

/** Original procedural engine/wind/siren; browser speech is an optional system voice. */
export class GameAudio {
  private context:AudioContext|null=null;
  private master:GainNode|null=null;
  private engine:OscillatorNode|null=null;
  private engineGain:GainNode|null=null;
  private windGain:GainNode|null=null;
  private siren:OscillatorNode|null=null;
  private sirenGain:GainNode|null=null;
  private horn:OscillatorNode|null=null;
  private hornGain:GainNode|null=null;
  private spoken='';
  unlock():void {
    try{
      if(!this.context){
        const context=new AudioContext();this.context=context;
        const master=context.createGain();master.gain.value=.24;master.connect(context.destination);this.master=master;
        const engine=context.createOscillator(),filter=context.createBiquadFilter(),engineGain=context.createGain();
        engine.type='sawtooth';engine.frequency.value=35;filter.type='lowpass';filter.frequency.value=580;engineGain.gain.value=0;
        engine.connect(filter);filter.connect(engineGain);engineGain.connect(master);engine.start();this.engine=engine;this.engineGain=engineGain;
        const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),channel=buffer.getChannelData(0);
        let smooth=0;for(let i=0;i<channel.length;i++){smooth=(smooth+Math.random()*2-1)*.6;channel[i]=smooth;}
        const noise=context.createBufferSource(),windFilter=context.createBiquadFilter(),windGain=context.createGain();
        noise.buffer=buffer;noise.loop=true;windFilter.type='lowpass';windFilter.frequency.value=800;windGain.gain.value=0;
        noise.connect(windFilter);windFilter.connect(windGain);windGain.connect(master);noise.start();this.windGain=windGain;
        const siren=context.createOscillator(),sirenGain=context.createGain();siren.type='sine';sirenGain.gain.value=0;
        siren.connect(sirenGain);sirenGain.connect(master);siren.start();this.siren=siren;this.sirenGain=sirenGain;
        const horn=context.createOscillator(),hornGain=context.createGain();horn.type='triangle';horn.frequency.value=350;hornGain.gain.value=0;
        horn.connect(hornGain);hornGain.connect(master);horn.start();this.horn=horn;this.hornGain=hornGain;
      }
      if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
    }catch{/* audio is optional; driving remains available */}
  }
  update(state:RunState|null,settings:ViewSettings):void {
    const context=this.context;
    if(context&&this.master){
      const active=state?.status==='driving';
      const traffic=trafficSoundLevels(state);
      this.master.gain.setTargetAtTime(settings.sound?.24:0,context.currentTime,.05);
      this.engine?.frequency.setTargetAtTime(27+(state?.rpm??900)*.017,context.currentTime,.045);
      this.engineGain?.gain.setTargetAtTime(active?.11:0,context.currentTime,.08);
      this.windGain?.gain.setTargetAtTime(active?Math.min(.18,(state?.speed??0)/1500):0,context.currentTime,.12);
      this.siren?.frequency.setTargetAtTime(580+Math.sin((state?.drivingTime??0)*7)*190,context.currentTime,.04);
      this.sirenGain?.gain.setTargetAtTime(traffic.siren,context.currentTime,.09);
      this.hornGain?.gain.setTargetAtTime(traffic.horn,context.currentTime,.025);
    }
    if(!('speechSynthesis' in window))return;
    if(!settings.speech||state?.status!=='driving'){
      if(speechSynthesis.speaking)speechSynthesis.cancel();return;
    }
    const comment=state.comment;
    if(comment&&comment.text!==this.spoken){
      this.spoken=comment.text;
      const line=new SpeechSynthesisUtterance(comment.text);line.lang='de-DE';line.rate=1.04;line.volume=.85;
      speechSynthesis.cancel();speechSynthesis.speak(line);
    }
  }
}
