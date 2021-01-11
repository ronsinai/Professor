const Chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const Nconf = require('nconf');
const Sinon = require('sinon');
const SinonChai = require('sinon-chai');

Chai.use(chaiAsPromised);
Chai.use(SinonChai);
const { expect } = Chai;

const exampleImaging = require('../data/imaging');
const { getMessage } = require('../utils/mq');
const { readKey, setKey } = require('../utils/redis');

describe('Consumer', () => {
  before(() => {
    this.exampleImaging = exampleImaging;
    this.badImaging = { _id: 'partial' };

    this.mq = global.consumerInstance.mq;
    this.diagnosesService = this.mq.diagnosesService;

    this.channel = this.mq.channel;
    this.redis = this.diagnosesService.redis;
  });

  beforeEach(() => {
    this.diagnosesServiceSpy = Sinon.spy(this.diagnosesService, 'update');
    this.redisSgetSpy = Sinon.spy(this.redis, 'getMembers');
    this.redisSaddSpy = Sinon.spy(this.redis, 'setMembers');

    this.publishStub = Sinon.stub(this.channel, 'publish');
    this.ackStub = Sinon.stub(this.channel, 'ack');
    this.rejectStub = Sinon.stub(this.channel, 'reject');
  });

  afterEach(() => {
    this.diagnosesServiceSpy.restore();
    this.redisSgetSpy.restore();
    this.redisSaddSpy.restore();

    this.publishStub.restore();
    this.ackStub.restore();
    this.rejectStub.restore();
  });

  describe('Diagnoses Service', () => {
    describe('#update', () => {
      it('should create redis key for imaging', async () => {
        const { _id, type } = this.exampleImaging;
        const diagnoses = Nconf.get('diagnoses')[type];
        await this.diagnosesService.update(_id, type);
        expect(this.redisSgetSpy).to.have.been.calledOnceWithExactly(type);
        expect(this.redisSaddSpy).to.have.been.calledOnceWithExactly(_id, Sinon.match.array);
        expect(this.redisSaddSpy.args[0][1].sort()).to.eql(diagnoses.sort());

        const redisDiagnoses = await readKey(_id);
        expect(redisDiagnoses.sort()).to.eql(diagnoses.sort());
      });

      it('should override redis key for imaging', async () => {
        const { _id, type } = this.exampleImaging;
        const diagnoses = Nconf.get('diagnoses')[type];

        await setKey(_id, [diagnoses[0]]);

        await this.diagnosesService.update(_id, type);
        expect(this.redisSgetSpy).to.have.been.calledOnceWithExactly(type);
        expect(this.redisSaddSpy).to.have.been.calledOnceWithExactly(_id, Sinon.match.array);
        expect(this.redisSaddSpy.args[0][1].sort()).to.eql(diagnoses.sort());

        const redisDiagnoses = await readKey(_id);
        expect(redisDiagnoses.sort()).to.eql(diagnoses.sort());
      });

      it('should fail update when redis get members throws', async () => {
        this.redisSgetSpy.restore();
        const redisSgetStub = Sinon.stub(this.redis, 'getMembers').throws();

        const { _id, type } = this.exampleImaging;
        await expect(this.diagnosesService.update(_id, type)).to.be.rejected;
        redisSgetStub.restore();
      });

      it('should fail update when redis set members throws', async () => {
        this.redisSaddSpy.restore();
        const redisSaddStub = Sinon.stub(this.redis, 'setMembers').throws();

        const { _id, type } = this.exampleImaging;
        await expect(this.diagnosesService.update(_id, type)).to.be.rejected;
        redisSaddStub.restore();
      });
    });
  });

  describe('Message Handler', () => {
    it('should create redis key, publish delayed discharge and ack when given proper message', async () => {
      const msg = getMessage(this.exampleImaging);
      await this.mq._msgHandler(msg);

      const imagingId = this.exampleImaging._id;
      const imagingType = this.exampleImaging.type;
      const diagnoses = Nconf.get('diagnoses')[imagingType];

      expect(this.diagnosesServiceSpy).to.have.been.calledOnceWith(imagingId, imagingType);
      expect(this.redisSgetSpy).to.have.been.calledOnceWith(imagingType);
      expect(this.redisSaddSpy).to.have.been.calledOnceWith(imagingId, Sinon.match.array);
      expect(this.redisSaddSpy.args[0][1].sort()).to.eql(diagnoses.sort());
      // eslint-disable-next-line max-len
      expect(this.publishStub).to.have.been.calledOnceWith(Sinon.match.any, Sinon.match.any, Buffer.from(JSON.stringify(imagingId)), Sinon.match.any);
      expect(this.ackStub).to.have.been.calledOnceWithExactly(msg);
      // eslint-disable-next-line no-unused-expressions
      expect(this.rejectStub).to.have.not.been.called;
    });

    it('should create correct redis key, publish delayed discharge and ack when given proper message and fix diagnoses', async () => {
      const msg = getMessage(this.exampleImaging);
      const imagingId = this.exampleImaging._id;
      const imagingType = this.exampleImaging.type;

      const update = 'example_diagnosis';
      const diagnoses = Nconf.get('diagnoses')[imagingType];
      diagnoses.push(update);

      this.redis.setMembers(this.exampleImaging.type, update);
      this.redisSaddSpy.restore();
      this.redisSaddSpy = Sinon.spy(this.redis, 'setMembers');

      await this.mq._msgHandler(msg);

      expect(this.diagnosesServiceSpy).to.have.been.calledOnceWith(imagingId, imagingType);
      expect(this.redisSgetSpy).to.have.been.calledOnceWith(imagingType);
      expect(this.redisSaddSpy).to.have.been.calledOnceWith(imagingId, Sinon.match.array);
      expect(this.redisSaddSpy.args[0][1].sort()).to.eql(diagnoses.sort());
      // eslint-disable-next-line max-len
      expect(this.publishStub).to.have.been.calledOnceWith(Sinon.match.any, Sinon.match.any, Buffer.from(JSON.stringify(imagingId)), Sinon.match.any);
      expect(this.ackStub).to.have.been.calledOnceWithExactly(msg);
      // eslint-disable-next-line no-unused-expressions
      expect(this.rejectStub).to.have.not.been.called;
    });

    it('should reject with no requeue when given improper message', async () => {
      const msg = getMessage(this.badImaging);
      await this.mq._msgHandler(msg);

      // eslint-disable-next-line no-unused-expressions
      expect(this.diagnosesServiceSpy).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.redisSgetSpy).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.redisSaddSpy).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.publishStub).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.ackStub).to.have.not.been.called;
      expect(this.rejectStub).to.have.been.calledOnceWithExactly(msg, false);
    });

    it('should reject with requeue proper message when fails to read redis key', async () => {
      const msg = getMessage(this.exampleImaging);

      this.redisSgetSpy.restore();
      this.redisSgetSpy = Sinon.stub(this.redis, 'getMembers').throws();

      await this.mq._msgHandler(msg);

      const imagingId = this.exampleImaging._id;
      const imagingType = this.exampleImaging.type;

      expect(this.diagnosesServiceSpy).to.have.been.calledOnceWith(imagingId, imagingType);
      expect(this.redisSgetSpy).to.have.been.calledOnceWith(imagingType);
      // eslint-disable-next-line no-unused-expressions
      expect(this.redisSaddSpy).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.publishStub).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.ackStub).to.have.not.been.called;
      expect(this.rejectStub).to.have.been.calledOnceWithExactly(msg, true);
    });

    it('should reject with requeue proper message when fails to create redis key', async () => {
      const msg = getMessage(this.exampleImaging);

      this.redisSaddSpy.restore();
      this.redisSaddSpy = Sinon.stub(this.redis, 'setMembers').throws();

      await this.mq._msgHandler(msg);

      const imagingId = this.exampleImaging._id;
      const imagingType = this.exampleImaging.type;
      const diagnoses = Nconf.get('diagnoses')[imagingType];

      expect(this.diagnosesServiceSpy).to.have.been.calledOnceWith(imagingId, imagingType);
      expect(this.redisSgetSpy).to.have.been.calledOnceWith(imagingType);
      expect(this.redisSaddSpy).to.have.been.calledOnceWith(imagingId, Sinon.match.array);
      expect(this.redisSaddSpy.args[0][1].sort()).to.eql(diagnoses.sort());
      // eslint-disable-next-line no-unused-expressions
      expect(this.publishStub).to.have.not.been.called;
      // eslint-disable-next-line no-unused-expressions
      expect(this.ackStub).to.have.not.been.called;
      expect(this.rejectStub).to.have.been.calledOnceWithExactly(msg, true);
    });

    it('should reject with requeue proper message when fails to publish delayed discharge', async () => {
      const msg = getMessage(this.exampleImaging);

      this.publishStub.restore();
      this.publishStub = Sinon.stub(this.channel, 'publish').throws();

      await this.mq._msgHandler(msg);

      const imagingId = this.exampleImaging._id;
      const imagingType = this.exampleImaging.type;
      const diagnoses = Nconf.get('diagnoses')[imagingType];

      expect(this.diagnosesServiceSpy).to.have.been.calledOnceWith(imagingId, imagingType);
      expect(this.redisSgetSpy).to.have.been.calledOnceWith(imagingType);
      expect(this.redisSaddSpy).to.have.been.calledOnceWith(imagingId, Sinon.match.array);
      expect(this.redisSaddSpy.args[0][1].sort()).to.eql(diagnoses.sort());
      // eslint-disable-next-line max-len
      expect(this.publishStub).to.have.been.calledOnceWith(Sinon.match.any, Sinon.match.any, Buffer.from(JSON.stringify(imagingId)), Sinon.match.any);
      // eslint-disable-next-line no-unused-expressions
      expect(this.ackStub).to.have.not.been.called;
      expect(this.rejectStub).to.have.been.calledOnceWithExactly(msg, true);
    });
  });
});
